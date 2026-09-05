import { normalCdf, rand01, seedFromLocation } from './random';

/**
 * Turning a hazard field into consequences: which structures are hit, how badly,
 * who is inside them, which roads are cut, and what it costs.
 *
 * Structure classes are inferred from footprint area and height because that is
 * all a vector basemap gives us. The inference is coarse and the UI says so —
 * but it is the difference between "1.2 km² affected" and "310 masonry
 * dwellings, 2 of them a school", and only the second one dispatches anybody.
 */

export const DAMAGE_LABELS = ['None', 'Slight', 'Moderate', 'Extensive', 'Destroyed'];

const CLASSES = {
  informal: {
    label: 'Informal / self-built',
    plinthM: 0.15,
    occupancyPerM2: 0.075,
    unitCostInr: 8000,
    depthDamage: { a: 0.95, b: 1.1 },
    fragilityPga: [0.08, 0.14, 0.22, 0.32],
    beta: 0.6,
  },
  masonry: {
    label: 'Load-bearing masonry',
    plinthM: 0.45,
    occupancyPerM2: 0.05,
    unitCostInr: 16000,
    depthDamage: { a: 0.75, b: 0.7 },
    fragilityPga: [0.12, 0.2, 0.32, 0.48],
    beta: 0.55,
  },
  rc: {
    label: 'RC frame',
    plinthM: 0.75,
    occupancyPerM2: 0.04,
    unitCostInr: 26000,
    depthDamage: { a: 0.55, b: 0.5 },
    fragilityPga: [0.2, 0.34, 0.55, 0.85],
    beta: 0.5,
  },
};

export const BUILDING_CLASSES = CLASSES;

const CRITICAL_KINDS = new Set(['hospital', 'clinic', 'school', 'college', 'university', 'fire_station', 'police', 'shelter']);

/** Shoelace area of a lon/lat ring, in m², using a local equirectangular scale. */
export function ringAreaM2(ring, latRef) {
  const mx = 111320 * Math.cos((latRef * Math.PI) / 180);
  const my = 110574;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * mx * (ring[i][1] * my) - ring[i][0] * mx * (ring[j][1] * my);
  }
  return Math.abs(sum) / 2;
}

/**
 * Give every footprint a construction class, an occupancy and a grid cell.
 * Height wins over area: anything tall enough is framed, anything small and low
 * is treated as informal, and the middle is masonry — which is what most of
 * Kolkata outside the CBD actually is.
 */
export function annotateBuildings(grid, buildings) {
  const seed = seedFromLocation(grid.centerLon, grid.centerLat, 991);
  const out = [];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const heightM = b.heightM > 0 ? b.heightM : 6;
    const levels = Math.max(1, Math.round(heightM / 3.1));
    let cls = 'masonry';
    if (heightM >= 13 || levels >= 4) cls = 'rc';
    else if (b.areaM2 < 48 && heightM < 6.5) cls = 'informal';
    if (CRITICAL_KINDS.has(b.kind)) cls = 'rc';

    const spec = CLASSES[cls];
    const floorArea = b.areaM2 * levels;
    const occupancy = Math.max(1, Math.round(floorArea * spec.occupancyPerM2));
    const gx = grid.xOf(b.centroid[0]);
    const gy = grid.yOf(b.centroid[1]);
    const inside = gx >= 0 && gy >= 0 && gx < grid.size && gy < grid.size;
    out.push({
      ...b,
      heightM,
      levels,
      cls,
      clsLabel: spec.label,
      floorAreaM2: floorArea,
      occupancy,
      replacementInr: floorArea * spec.unitCostInr,
      critical: CRITICAL_KINDS.has(b.kind),
      gi: inside ? gy * grid.size + gx : -1,
      // One stable uniform draw per structure, so fragility sampling is
      // reproducible and buildings fail in a consistent order.
      draw: rand01(seed, i, i * 7 + 1, 5),
    });
  }
  return out;
}

/** Sample grid cells along each road once, so severance is a cheap lookup later. */
export function annotateRoads(grid, roads) {
  const mx = 111320 * Math.cos((grid.centerLat * Math.PI) / 180);
  return roads.map((r) => {
    const cells = [];
    let lengthM = 0;
    for (let i = 0; i < r.coords.length; i++) {
      const [lon, lat] = r.coords[i];
      if (i > 0) {
        const [plon, plat] = r.coords[i - 1];
        lengthM += Math.hypot((lon - plon) * mx, (lat - plat) * 110574);
      }
      const gx = grid.xOf(lon);
      const gy = grid.yOf(lat);
      if (gx < 0 || gy < 0 || gx >= grid.size || gy >= grid.size) continue;
      const gi = gy * grid.size + gx;
      if (cells[cells.length - 1] !== gi) cells.push(gi);
    }
    return { ...r, cells, lengthM };
  });
}

function depthDamageState(cls, effectiveDepth) {
  const shift = cls === 'informal' ? 0.6 : cls === 'rc' ? 1.25 : 1;
  if (effectiveDepth <= 0.03) return 0;
  if (effectiveDepth < 0.5 * shift) return 1;
  if (effectiveDepth < 1.2 * shift) return 2;
  if (effectiveDepth < 2.2 * shift) return 3;
  return 4;
}

/** Lognormal fragility: the highest damage state whose exceedance beats the draw. */
function fragilityState(cls, pgaG, draw) {
  const spec = CLASSES[cls];
  let state = 0;
  for (let ds = 0; ds < spec.fragilityPga.length; ds++) {
    const z = Math.log(Math.max(1e-4, pgaG) / spec.fragilityPga[ds]) / spec.beta;
    if (normalCdf(z) > draw) state = ds + 1;
    else break;
  }
  return state;
}

const LOSS_RATIO_QUAKE = [0, 0.05, 0.2, 0.55, 1.0];
const LOSS_RATIO_FIRE = [0, 0.08, 0.35, 0.7, 1.0];

/**
 * Damage to a structure that is not itself alight but stands next to something
 * that is. Radiant flux falls off with distance and climbs with flame length, so
 * the tallest flame in the eight neighbours decides it: a two-and-a-half metre
 * flame one cell away will take the openings and the roof of a self-built house
 * without touching an RC frame across the same gap.
 */
const RADIANT_FLAME_M = { informal: 1.4, masonry: 2.2, rc: 3.4 };

function radiantState(grid, frame, b) {
  const gx = b.gi % grid.size;
  const gy = (b.gi - gx) / grid.size;
  let flame = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = gx + dx;
      const ny = gy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.size || ny >= grid.size) continue;
      const gi = ny * grid.size + nx;
      if (frame.state[gi] !== 1) continue;
      if (frame.flame[gi] > flame) flame = frame.flame[gi];
    }
  }
  if (flame <= 0) return 0;
  const threshold = RADIANT_FLAME_M[b.cls] || RADIANT_FLAME_M.masonry;
  if (flame >= threshold * 1.8) return 3;
  if (flame >= threshold) return 2;
  return 1;
}

const CASUALTY_RATES = {
  earthquake: { 3: [0.002, 0.01, 0.05], 4: [0.05, 0.1, 0.3] },
  fire: { 3: [0.001, 0.008, 0.04], 4: [0.004, 0.02, 0.08] },
  flood: { 3: [0.0005, 0.004, 0.03], 4: [0.002, 0.012, 0.06] },
};

/**
 * Score one timestep against everything we know is standing there.
 * Returns plain numbers and a per-building damage code, both indexed the same
 * way as the inputs, so the renderer can colour footprints without re-deriving.
 */
export function evaluateExposure({ hazard, grid, frame, buildings, roads, facilities, fields }) {
  const nB = buildings.length;
  const state = new Uint8Array(nB);
  const damageCounts = [0, 0, 0, 0, 0];
  const classDamage = { informal: [0, 0, 0, 0, 0], masonry: [0, 0, 0, 0, 0], rc: [0, 0, 0, 0, 0] };
  let lossInr = 0;
  let occupantsAffected = 0;
  let occupantsDisplaced = 0;
  const casualties = { fatal: 0, serious: 0, light: 0 };
  const collapseCells = new Set();

  for (let i = 0; i < nB; i++) {
    const b = buildings[i];
    if (b.gi < 0) continue;
    let ds = 0;
    let ratio = 0;

    if (hazard === 'flood') {
      const depth = frame.depth[b.gi];
      const eff = depth - CLASSES[b.cls].plinthM;
      ds = depthDamageState(b.cls, eff);
      if (ds > 0) {
        const curve = CLASSES[b.cls].depthDamage;
        ratio = Math.min(1, curve.a * (1 - Math.exp(-curve.b * Math.max(0, eff))));
      }
    } else if (hazard === 'fire') {
      const s = frame.state[b.gi];
      if (s === 2) ds = 4;
      else if (s === 1) ds = 3;
      else ds = radiantState(grid, frame, b);
      ratio = LOSS_RATIO_FIRE[ds];
    } else {
      const pga = fields.pga[b.gi];
      const finalDs = fragilityState(b.cls, pga, b.draw);
      const arrival = fields.arrivalSec[b.gi];
      const failAt = arrival + 0.18 * fields.durationSec[b.gi] * (0.4 + b.draw * 1.6);
      if (frame.seconds >= failAt) ds = finalDs;
      else if (frame.seconds >= arrival) ds = Math.min(finalDs, 1);
      ratio = LOSS_RATIO_QUAKE[ds];
    }

    state[i] = ds;
    damageCounts[ds]++;
    classDamage[b.cls][ds]++;
    lossInr += ratio * b.replacementInr;
    if (ds >= 2) occupantsAffected += b.occupancy;
    if (ds >= 3) {
      occupantsDisplaced += b.occupancy;
      collapseCells.add(b.gi);
    }
    const rates = CASUALTY_RATES[hazard]?.[ds];
    if (rates) {
      casualties.fatal += b.occupancy * rates[0];
      casualties.serious += b.occupancy * rates[1];
      casualties.light += b.occupancy * rates[2];
    }
  }

  // ── Roads ────────────────────────────────────────────────────────────
  const severed = new Uint8Array(roads.length);
  let severedLengthM = 0;
  let openLengthM = 0;
  for (let r = 0; r < roads.length; r++) {
    const road = roads[r];
    let cut = false;
    for (const gi of road.cells) {
      if (hazard === 'flood') {
        // 300 mm is where a car floats and a bus stalls.
        if (frame.depth[gi] > 0.3) cut = true;
      } else if (hazard === 'fire') {
        if (frame.state[gi] !== 0) cut = true;
      } else if (fields.mmi[gi] >= 8.2 || collapseCells.has(gi)) {
        cut = true;
      }
      if (cut) break;
    }
    severed[r] = cut ? 1 : 0;
    if (cut) severedLengthM += road.lengthM;
    else openLengthM += road.lengthM;
  }

  // ── Critical facilities ──────────────────────────────────────────────
  const facilityStatus = facilities.map((f) => {
    if (f.gi < 0) return { ...f, impacted: false, detail: 'outside study area' };
    if (hazard === 'flood') {
      const d = frame.depth[f.gi];
      return { ...f, impacted: d > 0.2, detail: d > 0.02 ? `${d.toFixed(2)} m of water` : 'dry' };
    }
    if (hazard === 'fire') {
      const s = frame.state[f.gi];
      return { ...f, impacted: s !== 0, detail: s === 1 ? 'fire at the site' : s === 2 ? 'burnt over' : 'clear' };
    }
    const m = fields.mmi[f.gi];
    return { ...f, impacted: m >= 7, detail: `MMI ${m.toFixed(1)}` };
  });

  const criticalHit = facilityStatus.filter((f) => f.impacted);
  return {
    buildingState: state,
    damageCounts,
    classDamage,
    lossInr,
    occupantsAffected,
    occupantsDisplaced,
    casualties: {
      fatal: Math.round(casualties.fatal),
      serious: Math.round(casualties.serious),
      light: Math.round(casualties.light),
    },
    severedRoads: severed,
    severedLengthM,
    openLengthM,
    severedCount: severed.reduce((a, v) => a + v, 0),
    facilityStatus,
    criticalHit,
    collapseCells,
  };
}

/** ₹ in the units an Indian control room actually reads. */
export function formatInr(v) {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} lakh`;
  if (v >= 1000) return `₹${Math.round(v / 1000)}k`;
  return `₹${Math.round(v)}`;
}
