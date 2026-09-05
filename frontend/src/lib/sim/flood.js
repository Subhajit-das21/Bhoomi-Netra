/**
 * Pluvial / fluvial inundation.
 *
 * The core is a priority flood: from every mapped water cell (or the incident
 * point when nothing is mapped) we solve the minimax-barrier problem — for each
 * cell, the lowest water surface at which it becomes *connected* to a source.
 * That single pass gives every timestep at once, and it handles depressions
 * correctly: a low courtyard behind a raised road stays dry until the water
 * clears the road, which is exactly the failure mode that catches people out.
 *
 * Depth then drives everything else: velocity through Manning's equation,
 * hazard rating through the HR Wallingford / DEFRA formula, and building damage
 * through depth–damage curves.
 */

/** Minimum-barrier flood order. Returns the spill stage for every cell. */
function spillStages(grid, elevation, sources) {
  const n = grid.size * grid.size;
  const size = grid.size;
  const spill = new Float32Array(n).fill(Infinity);
  // Binary min-heap over (key, index) in flat arrays — the grids are small but
  // this runs on every parameter change, so it should not allocate objects.
  const heapKey = new Float64Array(n + 1);
  const heapIdx = new Int32Array(n + 1);
  let heapSize = 0;

  const push = (key, idx) => {
    let i = ++heapSize;
    heapKey[i] = key;
    heapIdx[i] = idx;
    while (i > 1) {
      const parent = i >> 1;
      if (heapKey[parent] <= heapKey[i]) break;
      const tk = heapKey[parent];
      const ti = heapIdx[parent];
      heapKey[parent] = heapKey[i];
      heapIdx[parent] = heapIdx[i];
      heapKey[i] = tk;
      heapIdx[i] = ti;
      i = parent;
    }
  };

  const pop = () => {
    const topKey = heapKey[1];
    const topIdx = heapIdx[1];
    heapKey[1] = heapKey[heapSize];
    heapIdx[1] = heapIdx[heapSize];
    heapSize--;
    let i = 1;
    for (;;) {
      const l = i * 2;
      const r = l + 1;
      let m = i;
      if (l <= heapSize && heapKey[l] < heapKey[m]) m = l;
      if (r <= heapSize && heapKey[r] < heapKey[m]) m = r;
      if (m === i) break;
      const tk = heapKey[m];
      const ti = heapIdx[m];
      heapKey[m] = heapKey[i];
      heapIdx[m] = heapIdx[i];
      heapKey[i] = tk;
      heapIdx[i] = ti;
      i = m;
    }
    return [topKey, topIdx];
  };

  for (const s of sources) {
    if (elevation[s] < spill[s]) {
      spill[s] = elevation[s];
      push(elevation[s], s);
    }
  }

  const settled = new Uint8Array(n);
  while (heapSize > 0) {
    const [key, i] = pop();
    if (settled[i]) continue;
    settled[i] = 1;
    const x = i % size;
    const y = (i - x) / size;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (settled[ni]) continue;
        const barrier = Math.max(key, elevation[ni]);
        if (barrier < spill[ni]) {
          spill[ni] = barrier;
          push(barrier, ni);
        }
      }
    }
  }
  return spill;
}

/** DEFRA / HR Wallingford flood hazard rating, HR = d(v + 0.5) + DF. */
export function hazardRating(depthM, velMs, debrisFactor) {
  return depthM * (velMs + 0.5) + debrisFactor;
}

export function hazardClass(hr) {
  if (hr < 0.75) return 0; // caution
  if (hr < 1.25) return 1; // danger to some
  if (hr < 2.0) return 2; // danger to most
  return 3; // danger to all
}

export const HAZARD_CLASS_LABELS = [
  'Caution — shallow, slow',
  'Danger to some — children, elderly',
  'Danger to most — on foot',
  'Danger to all — including vehicles',
];

/**
 * Storm hydrograph, normalised to peak 1.0. Rises steeply, peaks at ~45% of the
 * window, then recedes — so the simulation shows the water going down again,
 * which is when most of the injuries and all of the looting happen.
 */
function hydrograph(frac) {
  const p = 0.45;
  if (frac <= 0) return 0;
  if (frac <= p) {
    const u = frac / p;
    return u * u * (3 - 2 * u);
  }
  const u = (frac - p) / (1 - p);
  return 1 - 0.62 * (u * u * (3 - 2 * u));
}

export function simulateFlood(grid, terrain, params) {
  const { size, cellAreaM2 } = grid;
  const n = size * size;
  const steps = params.steps ?? 32;
  const durationHr = params.durationHr ?? 12;
  const dtHr = durationHr / steps;
  const rainMmHr = params.rainMmHr ?? 55;
  const drainageQuality = params.drainageQuality ?? 0.5; // 0 blocked, 1 designed

  // Sources: mapped water if we have it, otherwise the incident cell itself —
  // a burst main or a surcharged drain, which is what an ESP32 water-level node
  // usually trips on.
  const sources = [];
  for (let i = 0; i < n; i++) if (terrain.water[i]) sources.push(i);
  let sourceKind = 'mapped watercourse';
  if (sources.length === 0) {
    sources.push(Math.floor(size / 2) * size + Math.floor(size / 2));
    sourceKind = 'point release at incident';
  }

  const spill = spillStages(grid, terrain.elevation, sources);
  let datum = Infinity;
  for (const s of sources) datum = Math.min(datum, terrain.elevation[s]);

  // Peak stage from rainfall depth times an urban concentration factor, damped
  // by whatever the drainage can carry away.
  const rainDepthM = (rainMmHr / 1000) * durationHr;
  const concentration = 9 + 6 * (1 - drainageQuality);
  const peakStageM = Math.max(0.25, rainDepthM * 0.82 * concentration * (1 - 0.35 * drainageQuality));

  const arrivalStep = new Int16Array(n).fill(-1);
  const frames = [];
  const eventLog = [];
  let peakDepthEver = 0;
  let peakAreaKm2 = 0;
  let peakFrame = 0;

  for (let t = 0; t <= steps; t++) {
    const stage = datum + peakStageM * hydrograph(t / steps);
    const depth = new Float32Array(n);
    const velocity = new Float32Array(n);
    const hr = new Float32Array(n);
    const norm = new Float32Array(n);
    const active = [];
    const classCounts = [0, 0, 0, 0];
    let wetCells = 0;
    let depthSum = 0;
    let maxDepth = 0;
    let volumeM3 = 0;
    let popExposed = 0;
    let newlyWet = 0;

    for (let i = 0; i < n; i++) {
      if (spill[i] > stage) continue;
      const d = stage - terrain.elevation[i];
      if (d <= 0.02) continue;
      depth[i] = d;
      wetCells++;
      depthSum += d;
      volumeM3 += d * cellAreaM2;
      if (d > maxDepth) maxDepth = d;
      if (arrivalStep[i] < 0) {
        arrivalStep[i] = t;
        newlyWet++;
      }
      popExposed += terrain.popDensity[i] * (cellAreaM2 / 1e6);

      const s = Math.max(0.0006, Math.tan(terrain.slope[i]));
      const v = Math.min(4.5, (1 / terrain.manningN[i]) * Math.pow(d, 2 / 3) * Math.sqrt(s));
      velocity[i] = v;
      const debris = d > 0.25 && terrain.builtUp[i] > 0.3 ? 0.5 : 0;
      const rating = hazardRating(d, v, debris);
      hr[i] = rating;
      classCounts[hazardClass(rating)]++;
      norm[i] = Math.min(1, d / 3.5);
      active.push(i);
    }

    const areaKm2 = (wetCells * cellAreaM2) / 1e6;
    if (areaKm2 > peakAreaKm2) {
      peakAreaKm2 = areaKm2;
      peakFrame = t;
    }
    if (maxDepth > peakDepthEver) peakDepthEver = maxDepth;
    const receding = t > 0 && stage < frames[t - 1].stage;

    if (newlyWet > wetCells * 0.25 && t > 0 && wetCells > 40) {
      eventLog.push({ t, kind: 'surge', text: `Inundated area grew by ${Math.round((newlyWet / Math.max(1, wetCells - newlyWet)) * 100)}% in one step` });
    }
    if (receding && !frames.some((f) => f.receding)) {
      eventLog.push({ t, kind: 'recession', text: 'Stage peaked — water is now falling' });
    }
    if (classCounts[3] > 0 && !eventLog.some((e) => e.kind === 'extreme')) {
      eventLog.push({ t, kind: 'extreme', text: 'Hazard rating exceeded 2.0 — unsafe for vehicles' });
    }

    frames.push({
      t,
      hours: t * dtHr,
      stage,
      receding,
      depth,
      velocity,
      hazardRating: hr,
      norm,
      active,
      metrics: {
        stageM: stage - datum,
        inundatedAreaKm2: areaKm2,
        inundatedAreaHa: areaKm2 * 100,
        maxDepthM: maxDepth,
        meanDepthM: wetCells ? depthSum / wetCells : 0,
        volumeM3,
        volumeMcm: volumeM3 / 1e6,
        populationExposed: Math.round(popExposed),
        hazardClassCounts: classCounts,
        dangerToAllKm2: (classCounts[3] * cellAreaM2) / 1e6,
        receding,
      },
    });
  }

  const peak = frames[peakFrame];
  return {
    frames,
    eventLog,
    timeUnit: 'h',
    dtHr,
    fields: { spill, arrivalStep, datum },
    scale: {
      field: 1,
      column: Math.max(0.5, peakDepthEver),
    },
    summary: {
      headline: `${peakAreaKm2.toFixed(2)} km² inundated at peak, ${peakDepthEver.toFixed(2)} m deepest`,
      peakFrame,
      finalMetrics: peak.metrics,
      assumptions: [
        `Rainfall ${rainMmHr} mm/h for ${durationHr} h`,
        `Source: ${sourceKind}`,
        `Drainage effectiveness ${Math.round(drainageQuality * 100)}%`,
        'Synthetic terrain — arrival order is indicative, not surveyed',
      ],
    },
  };
}
