import { buildGrid, buildTerrain } from './sim/terrain';
import { buildContext } from './sim/context';
import { annotateBuildings, annotateRoads, evaluateExposure, formatInr } from './sim/exposure';
import { simulateFire } from './sim/fire';
import { simulateFlood } from './sim/flood';
import { simulateQuake } from './sim/quake';
import { buildRoadGraph, planEvacuation } from './sim/routing';

/**
 * The orchestrator.
 *
 * One call builds the grid, harvests what the basemap knows about the place,
 * synthesises the terrain underneath it, runs the hazard model, scores every
 * timestep against the structures and people standing there, and plans the ways
 * out. Everything is derived from the incident coordinates and the parameters,
 * so the same inputs always give the same run.
 */

export const HAZARD_META = {
  fire: {
    label: 'Fire',
    blurb: 'Rothermel-style spread with wind, slope and fuel moisture',
    timeUnit: 'min',
    controls: [
      { key: 'windKmh', label: 'Wind speed', unit: 'km/h', min: 0, max: 90, step: 1, def: 18 },
      { key: 'windDirDeg', label: 'Wind from', unit: '°', min: 0, max: 350, step: 10, def: 225 },
      { key: 'fuelMoisturePct', label: 'Fuel moisture', unit: '%', min: 3, max: 40, step: 1, def: 9 },
      { key: 'reliefM', label: 'Terrain relief', unit: 'm', min: 2, max: 120, step: 2, def: 12 },
    ],
  },
  flood: {
    label: 'Flood',
    blurb: 'Rainfall to stage, minimax spill routing, DEFRA hazard rating',
    timeUnit: 'h',
    controls: [
      { key: 'rainMmHr', label: 'Rain intensity', unit: 'mm/h', min: 5, max: 180, step: 5, def: 55 },
      { key: 'durationHr', label: 'Event length', unit: 'h', min: 2, max: 48, step: 1, def: 12 },
      { key: 'drainageQuality', label: 'Drainage', unit: '', min: 0, max: 1, step: 0.05, def: 0.5 },
      { key: 'reliefM', label: 'Terrain relief', unit: 'm', min: 2, max: 120, step: 2, def: 12 },
    ],
  },
  earthquake: {
    label: 'Earthquake',
    blurb: 'Joyner & Boore attenuation, Vs30 amplification, fragility curves',
    timeUnit: 's',
    controls: [
      { key: 'magnitude', label: 'Magnitude', unit: 'Mw', min: 4, max: 8.5, step: 0.1, def: 6.3 },
      { key: 'depthKm', label: 'Focal depth', unit: 'km', min: 3, max: 60, step: 1, def: 12 },
      { key: 'reliefM', label: 'Terrain relief', unit: 'm', min: 2, max: 120, step: 2, def: 12 },
    ],
  },
};

export function defaultParams(hazard) {
  const out = {};
  for (const c of HAZARD_META[hazard]?.controls || []) out[c.key] = c.def;
  return out;
}

const SIMULATORS = { fire: simulateFire, flood: simulateFlood, earthquake: simulateQuake };

/** "T+14 min" and friends, with the precision each hazard actually needs. */
export function formatClock(hazard, frame) {
  if (hazard === 'fire') return `T+${Math.round(frame.minutes)} min`;
  if (hazard === 'flood') {
    return `T+${frame.hours < 10 ? frame.hours.toFixed(1) : Math.round(frame.hours)} h`;
  }
  return `T+${frame.seconds < 10 ? frame.seconds.toFixed(1) : Math.round(frame.seconds)} s`;
}

/** Which cells a route can pass through, and which count as reached safety. */
function blockingFor(hazard, frame, fields, collapseCells) {
  if (hazard === 'flood') {
    return {
      isBlocked: (e) => e.gi >= 0 && frame.depth[e.gi] > 0.3,
      isSafeCell: (gi) => gi >= 0 && frame.depth[gi] < 0.1,
    };
  }
  if (hazard === 'fire') {
    return {
      isBlocked: (e) => e.gi >= 0 && frame.state[e.gi] !== 0,
      isSafeCell: (gi) => gi >= 0 && frame.state[gi] === 0 && frame.norm[gi] < 0.15,
    };
  }
  return {
    isBlocked: (e) => e.gi >= 0 && (fields.mmi[e.gi] >= 8.2 || collapseCells.has(e.gi)),
    isSafeCell: (gi) => gi >= 0 && fields.mmi[gi] < 6.5,
  };
}

const SHELTER_KINDS = new Set(['shelter', 'school', 'college', 'university', 'hospital']);

/** The one number per hazard that answers "how big is this now". */
function footprintOf(hazard, m) {
  if (hazard === 'fire') return { value: m.burntAreaHa, unit: 'ha', label: 'Burnt area' };
  if (hazard === 'flood') return { value: m.inundatedAreaHa, unit: 'ha', label: 'Inundated area' };
  return { value: m.shakenAreaKm2, unit: 'km²', label: 'Area shaken' };
}

export function runSimulation({
  map = null,
  lon,
  lat,
  hazard = 'fire',
  radiusKm = 1.5,
  gridSize = 128,
  params = {},
}) {
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const settings = { ...defaultParams(hazard), ...params };
  const grid = buildGrid(lon, lat, radiusKm, gridSize);
  const context = buildContext(map, grid);
  const terrain = buildTerrain(grid, context, settings);
  const buildings = annotateBuildings(grid, context.buildings);
  const roads = annotateRoads(grid, context.roads);
  const facilities = context.facilities;

  const simulate = SIMULATORS[hazard] || simulateFire;
  const sim = simulate(grid, terrain, settings);

  const peak = {
    lossInr: 0, destroyed: 0, extensive: 0, affected: 0, displaced: 0,
    fatal: 0, serious: 0, light: 0, severedLengthM: 0, severedCount: 0,
    criticalHit: 0, footprint: 0,
  };
  const series = [];
  const milestones = [];
  const flag = (key, t, text) => {
    if (!milestones.some((m) => m.key === key)) milestones.push({ key, t, kind: 'impact', text });
  };

  const frames = sim.frames.map((frame) => {
    const exposure = evaluateExposure({
      hazard, grid, terrain, frame, buildings, roads, facilities, fields: sim.fields,
    });
    const fp = footprintOf(hazard, frame.metrics);
    const destroyed = exposure.damageCounts[4];
    const extensive = exposure.damageCounts[3];

    peak.lossInr = Math.max(peak.lossInr, exposure.lossInr);
    peak.destroyed = Math.max(peak.destroyed, destroyed);
    peak.extensive = Math.max(peak.extensive, extensive);
    peak.affected = Math.max(peak.affected, exposure.occupantsAffected);
    peak.displaced = Math.max(peak.displaced, exposure.occupantsDisplaced);
    peak.fatal = Math.max(peak.fatal, exposure.casualties.fatal);
    peak.serious = Math.max(peak.serious, exposure.casualties.serious);
    peak.light = Math.max(peak.light, exposure.casualties.light);
    peak.severedLengthM = Math.max(peak.severedLengthM, exposure.severedLengthM);
    peak.severedCount = Math.max(peak.severedCount, exposure.severedCount);
    peak.criticalHit = Math.max(peak.criticalHit, exposure.criticalHit.length);
    peak.footprint = Math.max(peak.footprint, fp.value);

    if (destroyed > 0) flag('first-collapse', frame.t, `First structure lost — ${destroyed} at this step`);
    if (exposure.criticalHit.length) {
      const f = exposure.criticalHit[0];
      flag('critical', frame.t, `${f.name || f.kindLabel} affected — ${f.detail}`);
    }
    if (exposure.occupantsDisplaced >= 50) {
      flag('displaced-50', frame.t, `${Math.round(exposure.occupantsDisplaced)} people need somewhere else to sleep`);
    }
    if (exposure.severedCount > 0) flag('road-cut', frame.t, `${exposure.severedCount} road links impassable`);

    series.push({
      t: frame.t,
      clock: formatClock(hazard, frame),
      footprint: fp.value,
      lossCr: exposure.lossInr / 1e7,
      destroyed,
      extensive,
      affected: exposure.occupantsAffected,
      displaced: exposure.occupantsDisplaced,
      fatal: exposure.casualties.fatal,
      severedKm: exposure.severedLengthM / 1000,
      exposedPop: frame.metrics.populationExposed ?? frame.metrics.populationFelt ?? 0,
    });

    return { ...frame, exposure, footprint: fp };
  });

  // Routing is worth its own pass only when somebody asks for a frame, so the
  // graph is built once and the Dijkstra is memoised per timestep.
  const graph = buildRoadGraph(grid, roads);
  const shelters = facilities.filter((f) => SHELTER_KINDS.has(f.kind));
  const evacCache = new Map();
  const evacuationAt = (index) => {
    const i = Math.max(0, Math.min(frames.length - 1, Math.round(index) || 0));
    if (evacCache.has(i)) return evacCache.get(i);
    const frame = frames[i];
    const { isBlocked, isSafeCell } = blockingFor(
      hazard, frame, sim.fields, frame.exposure.collapseCells,
    );
    const plan = planEvacuation({
      grid, graph, origin: [lon, lat], isBlocked, isSafeCell, shelters,
    });
    evacCache.set(i, plan);
    return plan;
  };

  const eventLog = [...sim.eventLog, ...milestones]
    .sort((a, b) => a.t - b.t)
    .map((e) => ({ ...e, clock: formatClock(hazard, frames[Math.min(frames.length - 1, e.t)]) }));

  const final = frames[frames.length - 1];
  const assumptions = [
    ...(sim.summary.assumptions || []),
    context.source === 'basemap'
      ? 'Construction class inferred from footprint area and height, not from survey'
      : 'No footprints were available here, so the structures shown are invented',
    'Occupancy, replacement cost and casualty rates are planning ratios, not a census',
    'Elevation is synthetic fractal terrain, not a survey DEM',
  ];

  return {
    hazard,
    hazardLabel: HAZARD_META[hazard]?.label || hazard,
    center: [lon, lat],
    radiusKm,
    settings,
    grid,
    terrain,
    buildings,
    roads,
    facilities,
    frames,
    series,
    eventLog,
    evacuationAt,
    fields: sim.fields,
    scale: sim.scale,
    timeUnit: sim.timeUnit,
    dt: sim.dtMin ?? sim.dtHr ?? sim.dtSec,
    peak,
    provenance: {
      source: context.source,
      sourceLabel: context.sourceLabel,
      counts: context.counts,
      builtUpSource: terrain.builtUpSource,
      roadNodes: graph.nodes.length,
      hadMap: Boolean(map),
    },
    summary: {
      ...sim.summary,
      impact: `${peak.destroyed} structures lost, ${Math.round(peak.displaced)} displaced, `
        + `${formatInr(peak.lossInr)} damage`,
      finalExposure: final.exposure,
      peak,
      assumptions,
    },
    runtimeMs: Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
    ),
  };
}

// HOTFIX: Legacy wrapper for older components calling generateDynamicSimulation
export function generateDynamicSimulation(lon, lat, hazard, radiusKm) {
  return runSimulation({ lon, lat, hazard, radiusKm });
}
