import { rand01 } from './random';

/**
 * Surface fire spread.
 *
 * A stochastic cellular front where each cell-to-cell jump is driven by a rate
 * of spread in the Rothermel style: a fuel- and moisture-dependent base rate,
 * multiplied by a wind factor and a slope factor along the direction of the
 * jump. That is what produces the lopsided, fingered head fire you see in real
 * perimeters instead of an expanding disc.
 *
 * Cells hold three states over time — unburnt, burning for a fuel-dependent
 * residence time, then burnt out — so the *front* is a ring and the interior is
 * a cooling scar. Firebreaks (mapped water, wide roads) cut spread probability.
 */

export const FIRE_STATE = { UNBURNT: 0, BURNING: 1, BURNT: 2 };

const HEAT_YIELD_KJ_KG = 18600; // dry woody fuel, Byram's low heat of combustion
const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Indian National AQI breakpoints for PM2.5, 24-hour basis. */
export function pm25ToAqi(c) {
  const bands = [
    [0, 30, 0, 50], [30, 60, 51, 100], [60, 90, 101, 200],
    [90, 120, 201, 300], [120, 250, 301, 400], [250, 500, 401, 500],
  ];
  for (const [cl, ch, al, ah] of bands) {
    if (c <= ch) return Math.round(al + ((ah - al) * (c - cl)) / (ch - cl));
  }
  return 500;
}

export function aqiBand(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very poor';
  return 'Severe';
}

export function simulateFire(grid, terrain, params) {
  const { size, cellSizeM, cellAreaM2 } = grid;
  const n = size * size;
  const steps = params.steps ?? 32;
  const dtMin = params.dtMin ?? Math.max(2, Math.min(20, Math.round(grid.radiusKm * 2.5)));
  const windKmh = params.windKmh ?? 18;
  const windDirDeg = params.windDirDeg ?? 225;
  const moisturePct = params.fuelMoisturePct ?? 9;
  const seed = terrain.seed;

  // Fuel load in kg/m². Vegetation carries most of it; dense built-up ground
  // still burns, just slower, and mapped water carries nothing.
  const fuel = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    fuel[i] = terrain.water[i]
      ? 0
      : (0.35 + 2.7 * terrain.vegetation[i] + 1.1 * terrain.builtUp[i]) *
        (1 - 0.7 * Math.min(1, terrain.roadWeight[i]));
  }

  const moistureDamp = Math.max(0.05, Math.exp(-0.085 * (moisturePct - 5)));
  const spreadRad = ((windDirDeg + 180) * Math.PI) / 180;
  const spreadEast = Math.sin(spreadRad);
  const spreadNorth = Math.cos(spreadRad);

  // Per-direction wind factor is constant across the grid, so lift it out.
  const dirs = NEIGHBOURS.map(([dx, dy]) => {
    const len = Math.hypot(dx, dy);
    const cosTheta = (dx * spreadEast + dy * spreadNorth) / len;
    const windFactor = Math.max(0.12, Math.min(14, Math.exp(0.055 * windKmh * cosTheta)));
    return { dx, dy, distM: len * cellSizeM, cosTheta, windFactor };
  });

  const state = new Uint8Array(n);
  const igniteStep = new Int16Array(n).fill(-1);
  const burnUntil = new Int16Array(n).fill(-1);
  const rosAtIgnition = new Float32Array(n);

  const start = { x: Math.floor(size / 2), y: Math.floor(size / 2) };
  const startIdx = start.y * size + start.x;
  state[startIdx] = FIRE_STATE.BURNING;
  igniteStep[startIdx] = 0;
  burnUntil[startIdx] = Math.max(1, Math.round((8 + 24 * Math.min(1, fuel[startIdx] / 3)) / dtMin));
  rosAtIgnition[startIdx] = 1.5;

  const frames = [];
  const eventLog = [];
  let front = [startIdx];
  let spotTotal = 0;
  let peakRos = 0;

  for (let t = 0; t <= steps; t++) {
    if (t > 0) {
      const ignitedThisStep = [];
      for (const ci of front) {
        const cx = ci % size;
        const cy = (ci - cx) / size;
        for (let d = 0; d < dirs.length; d++) {
          const { dx, dy, distM, windFactor } = dirs[d];
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const ni = ny * size + nx;
          if (state[ni] !== FIRE_STATE.UNBURNT || fuel[ni] <= 0.02) continue;

          // Slope factor along this jump — fire climbs, and reluctantly descends.
          const rise = terrain.elevation[ni] - terrain.elevation[ci];
          const slopeFactor = Math.max(0.35, Math.min(4.5, Math.exp(3.0 * (rise / distM))));
          const base = 2.4 * (0.25 + fuel[ni] / 2.6) * moistureDamp;
          const ros = base * windFactor * slopeFactor;
          if (ros > peakRos) peakRos = ros;

          let p = 1 - Math.exp((-ros * dtMin) / distM);
          p *= 1 - 0.8 * Math.min(1, terrain.roadWeight[ni]);
          if (rand01(seed + 977, nx, ny, t * 31 + d) < p) {
            state[ni] = FIRE_STATE.BURNING;
            igniteStep[ni] = t;
            rosAtIgnition[ni] = ros;
            burnUntil[ni] = t + Math.max(1, Math.round((8 + 24 * Math.min(1, fuel[ni] / 3)) / dtMin));
            ignitedThisStep.push(ni);
          }
        }
      }

      // Ember spotting. Long-range jumps ahead of the front are how urban
      // fires cross the barriers that were supposed to hold them.
      const spotChance = Math.min(0.45, windKmh * 0.006);
      let spotsThisStep = 0;
      for (let f = 0; f < front.length && spotsThisStep < 5; f++) {
        if (rand01(seed + 4409, front[f], t, 3) > spotChance) continue;
        const cx = front[f] % size;
        const cy = (front[f] - cx) / size;
        const reach = (0.4 + rand01(seed + 61, front[f], t, 9) * 0.9) * (0.9 + 0.05 * Math.pow(windKmh, 1.35));
        const jitter = (rand01(seed + 83, front[f], t, 11) - 0.5) * 0.5;
        const nx = Math.round(cx + (spreadEast + jitter) * reach);
        const ny = Math.round(cy + (spreadNorth + jitter) * reach);
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (state[ni] !== FIRE_STATE.UNBURNT || fuel[ni] < 0.4) continue;
        state[ni] = FIRE_STATE.BURNING;
        igniteStep[ni] = t;
        rosAtIgnition[ni] = 1.2;
        burnUntil[ni] = t + Math.max(1, Math.round((8 + 24 * Math.min(1, fuel[ni] / 3)) / dtMin));
        ignitedThisStep.push(ni);
        spotsThisStep++;
        spotTotal++;
      }
      if (spotsThisStep > 0) {
        eventLog.push({
          t,
          kind: 'spotting',
          text: `${spotsThisStep} spot fire${spotsThisStep > 1 ? 's' : ''} ignited downwind of the head`,
        });
      }

      for (let i = 0; i < n; i++) {
        if (state[i] === FIRE_STATE.BURNING && burnUntil[i] <= t) state[i] = FIRE_STATE.BURNT;
      }
      front = [];
      for (let i = 0; i < n; i++) if (state[i] === FIRE_STATE.BURNING) front.push(i);
    }

    // ── Per-frame fields ────────────────────────────────────────────────
    const intensity = new Float32Array(n); // kW/m, Byram
    const flame = new Float32Array(n); // m
    const norm = new Float32Array(n); // 0..1 for the ground raster
    const active = [];
    let burntCells = 0;
    let burningCells = 0;
    let intensitySum = 0;
    let burningFuelSum = 0;
    let maxFlame = 0;
    let popExposed = 0;
    let frontCx = 0;
    let frontCy = 0;

    for (let i = 0; i < n; i++) {
      const s = state[i];
      if (s === FIRE_STATE.UNBURNT) continue;
      popExposed += terrain.popDensity[i] * (cellAreaM2 / 1e6);
      if (s === FIRE_STATE.BURNING) {
        // Byram: I = H · w · R, with R converted from m/min to m/s.
        const I = (HEAT_YIELD_KJ_KG * fuel[i] * rosAtIgnition[i]) / 60;
        intensity[i] = I;
        flame[i] = 0.0775 * Math.pow(Math.max(1, I), 0.46);
        if (flame[i] > maxFlame) maxFlame = flame[i];
        intensitySum += I;
        burningFuelSum += fuel[i];
        burningCells++;
        norm[i] = Math.min(1, 0.62 + I / 9000);
        active.push(i);
        frontCx += i % size;
        frontCy += Math.floor(i / size);
      } else {
        burntCells++;
        const age = t - (burnUntil[i] < 0 ? t : burnUntil[i]);
        norm[i] = Math.max(0.12, 0.46 - age * 0.02);
      }
    }
    if (burningCells > 0) {
      frontCx /= burningCells;
      frontCy /= burningCells;
    } else {
      frontCx = start.x;
      frontCy = start.y;
    }

    // Perimeter length: every edge where fire meets unburnt ground is a metre
    // of line that somebody has to hold.
    let perimeterEdges = 0;
    let brokenEdges = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (state[i] === FIRE_STATE.UNBURNT) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const ni = ny * size + nx;
          if (state[ni] !== FIRE_STATE.UNBURNT) continue;
          perimeterEdges++;
          if (terrain.water[ni] || terrain.roadWeight[ni] > 0.6 || fuel[ni] < 0.15) brokenEdges++;
        }
      }
    }

    // ── Smoke: Gaussian plume from the head of the fire ─────────────────
    // Ground-level concentration downwind of the active front, Briggs urban
    // dispersion. This is the number that decides who has to shelter indoors
    // several kilometres from a fire they cannot see.
    const smoke = new Float32Array(n);
    let smokeMax = 0;
    if (burningCells > 0) {
      const burningAreaM2 = burningCells * cellAreaM2;
      const residenceS = 18 * 60;
      const meanFuel = Math.max(0.2, burningFuelSum / burningCells);
      const consumptionKgS = (burningAreaM2 * meanFuel) / residenceS;
      const qGs = consumptionKgS * 13; // ~13 g PM2.5 per kg of fuel burnt
      const uMs = Math.max(1, windKmh / 3.6);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const ex = (x - frontCx) * cellSizeM;
          const ny = (y - frontCy) * cellSizeM;
          const along = ex * spreadEast + ny * spreadNorth;
          if (along <= cellSizeM) continue;
          const across = -ex * spreadNorth + ny * spreadEast;
          const sy = 0.22 * along * Math.pow(1 + 0.0004 * along, -0.5);
          const sz = 0.2 * along;
          const c = ((qGs / (Math.PI * sy * sz * uMs)) * Math.exp((-across * across) / (2 * sy * sy))) * 1e6;
          smoke[y * size + x] = c;
          if (c > smokeMax) smokeMax = c;
        }
      }
    }

    const aqi = pm25ToAqi(Math.min(500, smokeMax));
    const burntHa = ((burntCells + burningCells) * cellAreaM2) / 10000;
    frames.push({
      t,
      minutes: t * dtMin,
      state: Uint8Array.from(state),
      norm,
      intensity,
      flame,
      smoke,
      active,
      centroid: [grid.lonOf(frontCx), grid.latOf(frontCy)],
      metrics: {
        burntAreaHa: burntHa,
        burntAreaKm2: burntHa / 100,
        activeFrontCells: burningCells,
        perimeterM: perimeterEdges * cellSizeM,
        heldPerimeterPct: perimeterEdges ? (brokenEdges / perimeterEdges) * 100 : 0,
        maxRosMPerMin: peakRos,
        meanIntensityKwM: burningCells ? intensitySum / burningCells : 0,
        maxFlameLengthM: maxFlame,
        spotFires: spotTotal,
        populationExposed: Math.round(popExposed),
        smokePm25UgM3: smokeMax,
        smokeAqi: aqi,
        smokeBand: aqiBand(aqi),
      },
    });
  }

  const last = frames[frames.length - 1];
  return {
    frames,
    eventLog,
    timeUnit: 'min',
    dtMin,
    fields: { fuel },
    // Peak values over the whole run, so the colour ramp and the charts share
    // one scale instead of rescaling under the operator every frame.
    scale: {
      field: 1,
      column: Math.max(1, frames.reduce((m, f) => Math.max(m, f.metrics.maxFlameLengthM), 0)),
      smoke: Math.max(1, frames.reduce((m, f) => Math.max(m, f.metrics.smokePm25UgM3), 0)),
    },
    summary: {
      headline: `${last.metrics.burntAreaHa.toFixed(0)} ha burnt by T+${Math.round((last.minutes / 60) * 10) / 10}h`,
      finalMetrics: last.metrics,
      assumptions: [
        `Wind ${windKmh} km/h from ${Math.round(windDirDeg)}°`,
        `Dead fuel moisture ${moisturePct}%`,
        'Fuel load inferred from land cover, not surveyed',
      ],
    },
  };
}
