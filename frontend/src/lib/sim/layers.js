import {
  BitmapLayer, ColumnLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer,
} from '@deck.gl/layers';
import { RAMPS, contourSegments, fieldToCanvas } from './raster';

/**
 * Everything the map draws, in one place.
 *
 * The stack, bottom to top: a ground wash for the hazard field, isolines so you
 * can read a value off that wash, roads with their severed sections picked out,
 * extruded building footprints shaded by damage state, columns for the cells
 * that are actively burning or flooded, then routes, facilities and labels.
 *
 * Buildings are drawn without hue on purpose. The ground already carries the
 * hazard's colour — cyan for water, orange for fire, magenta for shaking — and a
 * building tinted from the same ramp disappears into it exactly where the
 * operator most needs to count structures. So damage climbs in lightness from
 * near-black to bone, and the extrusions keep a dark wireframe so their
 * silhouettes hold up over a bright wash.
 *
 * The undamaged end of that ramp is deliberately close to the basemap's own
 * extrusions: a study square with nothing wrong in it should look like the city
 * around it, not like a pale slab dropped on top of the map. Damage is what
 * lights up.
 */

const DAMAGE_FILL = [
  [38, 44, 54, 235],     // none — the town, not the news
  [96, 103, 114, 238],   // slight
  [152, 158, 168, 241],  // moderate
  [205, 209, 216, 244],  // extensive
  [246, 248, 252, 248],  // destroyed
];

/** Damage state 0–4 to a fill. Achromatic, so the hazard wash keeps the colour. */
export function damageColor(ds) {
  return DAMAGE_FILL[ds] || DAMAGE_FILL[0];
}

const CONTOURS = {
  fire: { thresholds: [0.35, 0.62, 0.86], label: null },
  flood: { thresholds: [0.3, 0.6, 1.2, 2.4], label: (v) => `${v} m` },
  earthquake: { thresholds: [5, 6, 7, 8, 9], label: (v) => `MMI ${v}` },
};

/** A closed ring of `lon,lat` at a fixed radius — wavefronts and study bounds. */
function ringAt(lon, lat, radiusKm, steps = 96) {
  const mx = 111.32 * Math.cos((lat * Math.PI) / 180);
  const path = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    path.push([lon + (Math.cos(a) * radiusKm) / mx, lat + (Math.sin(a) * radiusKm) / 110.574]);
  }
  return path;
}

const centreOf = (grid, gi) => {
  const x = gi % grid.size;
  return [grid.lonOf(x), grid.latOf((gi - x) / grid.size)];
};

/** The field the ground wash and the isolines are read from. */
export function washField(sim, frame) {
  if (sim.hazard === 'flood') return { field: frame.norm, contour: frame.depth };
  if (sim.hazard === 'fire') return { field: frame.norm, contour: frame.norm };
  return { field: frame.norm, contour: sim.fields.mmi };
}

export function washCanvas(sim, frame) {
  const { field } = washField(sim, frame);
  return fieldToCanvas(field, sim.grid.size, RAMPS[sim.hazard] || RAMPS.fire, {
    gamma: sim.hazard === 'earthquake' ? 1.1 : 0.85,
    maxAlpha: 200,
    cutoff: 0.02,
  });
}

export function smokeCanvas(sim, frame) {
  const max = sim.scale.smoke || 1;
  return fieldToCanvas(frame.smoke, sim.grid.size, RAMPS.smoke, {
    gamma: 0.7,
    maxAlpha: 120,
    cutoff: 0.04,
    scale: 1 / max,
  });
}

/** Column height in metres for one active cell, per hazard. */
function columnHeight(sim, frame, gi) {
  if (sim.hazard === 'fire') return Math.max(2, frame.flame[gi] * 7);
  if (sim.hazard === 'flood') return Math.max(1, frame.depth[gi] * 12);
  return Math.max(1, frame.norm[gi] * 60);
}

/** Thin the active list so a full grid still draws in one frame. */
function sampleActive(active, limit = 5000) {
  if (active.length <= limit) return active;
  const stride = Math.ceil(active.length / limit);
  const out = [];
  for (let i = 0; i < active.length; i += stride) out.push(active[i]);
  return out;
}

/** What the marker at the incident coordinates actually is, per hazard. */
const ORIGIN_LABEL = {
  fire: 'Ignition',
  flood: 'Reported location',
  earthquake: 'Epicentre',
};

// Which affected sites earn a name on the map, when everything is affected.
// Response triage order, then a minimum spacing so two names never sit on top of
// one another, then a hard cap — six is about what fits over a 2 km square.
const LABEL_PRIORITY = ['hospital', 'clinic', 'fire_station', 'police', 'shelter',
  'school', 'college', 'university'];
const MAX_FACILITY_LABELS = 6;
const LABEL_SPACING_M = 240;

function pickFacilityLabels(candidates, grid) {
  const rank = (f) => {
    const i = LABEL_PRIORITY.indexOf(f.kind);
    return i < 0 ? LABEL_PRIORITY.length : i;
  };
  const mx = 111320 * Math.cos((grid.centerLat * Math.PI) / 180);
  const kept = [];
  for (const f of [...candidates].sort((a, b) => rank(a) - rank(b))) {
    if (kept.length >= MAX_FACILITY_LABELS) break;
    const clash = kept.some((k) => Math.hypot(
      (f.lon - k.lon) * mx, (f.lat - k.lat) * 110574,
    ) < LABEL_SPACING_M);
    if (!clash) kept.push(f);
  }
  return kept;
}

const LABEL_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const labelStyle = {
  getSize: 11,
  sizeUnits: 'pixels',
  fontFamily: LABEL_FONT,
  // The default atlas is ASCII only, and the names on this map are not: a school
  // in Rajarhat is as likely to be labelled "বিদ্যালয়" as "School". Building the
  // atlas from the strings we actually draw is what stops those turning into tofu.
  characterSet: 'auto',
  fontSettings: { sdf: true },
  outlineWidth: 3,
  outlineColor: [0, 0, 0, 220],
  getTextAnchor: 'middle',
  getAlignmentBaseline: 'bottom',
};

export function buildLayers({ sim, frame, tIndex, plan, show, wash, smoke }) {
  const { grid, hazard } = sim;
  const [olon, olat] = sim.center;
  const ramp = RAMPS[hazard] || RAMPS.fire;
  const layers = [];

  layers.push(new PathLayer({
    id: 'sim-bounds',
    data: [[[grid.west, grid.south], [grid.east, grid.south], [grid.east, grid.north],
      [grid.west, grid.north], [grid.west, grid.south]]],
    getPath: (d) => d,
    getColor: [255, 255, 255, 38],
    getWidth: 1,
    widthUnits: 'pixels',
    widthMinPixels: 1,
  }));

  // Standing water, before anything happens to it. The flood model spills from
  // these polygons and the fire will not cross them, so drawing them is not
  // decoration: it is showing the operator the boundary condition.
  if (show.water && sim.water?.length) {
    layers.push(new PolygonLayer({
      id: 'sim-water',
      data: sim.water,
      extruded: false,
      filled: true,
      stroked: true,
      getPolygon: (poly) => poly,
      getFillColor: [16, 62, 88, 190],
      getLineColor: [82, 158, 190, 170],
      getLineWidth: 1.2,
      lineWidthUnits: 'pixels',
      lineWidthMinPixels: 1,
    }));
  }

  if (show.wash && wash) {
    layers.push(new BitmapLayer({
      id: 'sim-wash', bounds: grid.bounds, image: wash, opacity: 0.95,
    }));
  }

  if (show.smoke && smoke && hazard === 'fire') {
    layers.push(new BitmapLayer({
      id: 'sim-smoke', bounds: grid.bounds, image: smoke, opacity: 0.55,
    }));
  }

  if (show.contours) {
    const spec = CONTOURS[hazard];
    const { contour } = washField(sim, frame);
    const bands = contourSegments(contour, grid, spec.thresholds);
    const segs = [];
    const labels = [];
    bands.forEach((band, rank) => {
      for (const seg of band.segments) segs.push({ path: seg, rank });
      if (spec.label && band.segments.length > 8) {
        const pick = band.segments[Math.floor(band.segments.length / 2)];
        labels.push({ position: pick[0], text: spec.label(band.threshold) });
      }
    });
    layers.push(new PathLayer({
      id: 'sim-contours',
      data: segs,
      getPath: (d) => d.path,
      getColor: (d) => [255, 255, 255, 55 + d.rank * 38],
      getWidth: (d) => 1 + d.rank * 0.5,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      updateTriggers: { getPath: [tIndex], getColor: [tIndex] },
    }));
    if (labels.length) {
      layers.push(new TextLayer({
        id: 'sim-contour-labels',
        data: labels,
        getPosition: (d) => d.position,
        getText: (d) => d.text,
        getColor: [255, 255, 255, 190],
        ...labelStyle,
        getSize: 10,
        updateTriggers: { getPosition: [tIndex], getText: [tIndex] },
      }));
    }
  }

  if (show.roads) {
    layers.push(new PathLayer({
      id: 'sim-roads',
      data: sim.roads,
      getPath: (r) => r.coords,
      getColor: (r, { index }) => (frame.exposure.severedRoads[index]
        ? [246, 248, 252, 235]
        : [124, 131, 145, 130]),
      getWidth: (r) => 1.5 + r.weight * 6,
      widthUnits: 'meters',
      widthMinPixels: 1,
      widthMaxPixels: 12,
      capRounded: true,
      jointRounded: true,
      pickable: true,
      updateTriggers: { getColor: [tIndex] },
    }));
  }

  if (show.buildings) {
    layers.push(new PolygonLayer({
      id: 'sim-buildings',
      data: sim.buildings,
      extruded: true,
      filled: true,
      wireframe: true,
      pickable: true,
      getPolygon: (b) => b.ring,
      getElevation: (b) => Math.max(3, b.heightM),
      getFillColor: (b, { index }) => damageColor(frame.exposure.buildingState[index]),
      getLineColor: [10, 12, 16, 190],
      material: { ambient: 0.4, diffuse: 0.65, shininess: 24, specularColor: [38, 40, 46] },
      updateTriggers: { getFillColor: [tIndex, hazard] },
    }));
    // Hospitals, schools and stations get an outline, so they read as different
    // without needing a colour of their own.
    const critical = sim.buildings.filter((b) => b.critical);
    if (critical.length) {
      layers.push(new PathLayer({
        id: 'sim-critical-outline',
        data: critical,
        getPath: (b) => b.ring,
        getColor: [255, 255, 255, 210],
        getWidth: 1.6,
        widthUnits: 'pixels',
        widthMinPixels: 1.2,
      }));
    }
  }

  if (show.columns && frame.active.length) {
    const active = sampleActive(frame.active);
    layers.push(new ColumnLayer({
      id: 'sim-columns',
      data: active,
      diskResolution: 4,
      angle: 45,
      radius: grid.cellSizeM / Math.SQRT2,
      extruded: true,
      flatShading: true,
      getPosition: (gi) => centreOf(grid, gi),
      getElevation: (gi) => columnHeight(sim, frame, gi),
      getFillColor: (gi) => {
        const [r, g, b] = ramp(Math.min(1, frame.norm[gi]));
        return [r, g, b, 155];
      },
      updateTriggers: {
        getPosition: [tIndex], getElevation: [tIndex], getFillColor: [tIndex],
      },
    }));
  }

  if (hazard === 'earthquake' && show.wavefront) {
    const rings = [];
    if (frame.pRadiusKm > 0.03) rings.push({ kind: 'P', path: ringAt(olon, olat, frame.pRadiusKm) });
    if (frame.sRadiusKm > 0.03) rings.push({ kind: 'S', path: ringAt(olon, olat, frame.sRadiusKm) });
    layers.push(new PathLayer({
      id: 'sim-wavefront',
      data: rings,
      getPath: (d) => d.path,
      getColor: (d) => (d.kind === 'P' ? [255, 255, 255, 85] : [255, 255, 255, 185]),
      getWidth: (d) => (d.kind === 'P' ? 1 : 2),
      widthUnits: 'pixels',
      widthMinPixels: 1,
      updateTriggers: { getPath: [tIndex] },
    }));
  }

  if (show.corridors && plan?.corridors?.length) {
    layers.push(new PathLayer({
      id: 'sim-corridors',
      data: plan.corridors,
      getPath: (c) => c.path,
      getColor: (c) => (c.compromisedMeters > 1
        ? [255, 255, 255, 150]
        : [255, 255, 255, 240]),
      getWidth: (c, { index }) => 5 - index,
      widthUnits: 'pixels',
      widthMinPixels: 2,
      capRounded: true,
      jointRounded: true,
    }));
    layers.push(new TextLayer({
      id: 'sim-corridor-labels',
      data: plan.corridors,
      getPosition: (c) => c.path[c.path.length - 1],
      getText: (c) => `${c.compass} ${c.target}, ${Math.round(c.walkSeconds / 60)} min walk`,
      getColor: [255, 255, 255, 235],
      getPixelOffset: [0, -10],
      ...labelStyle,
    }));
  }

  if (show.facilities && frame.exposure.facilityStatus.length) {
    const sites = frame.exposure.facilityStatus.filter((f) => f.gi >= 0);
    layers.push(new ScatterplotLayer({
      id: 'sim-facilities',
      data: sites,
      stroked: true,
      filled: true,
      radiusUnits: 'pixels',
      lineWidthUnits: 'pixels',
      getPosition: (f) => [f.lon, f.lat],
      getRadius: (f) => (f.impacted ? 5.5 : 3.2),
      getFillColor: (f) => (f.impacted ? [255, 255, 255, 235] : [16, 18, 22, 200]),
      getLineColor: (f) => (f.impacted ? [255, 255, 255, 255] : [200, 206, 216, 170]),
      getLineWidth: 1.2,
      pickable: true,
      updateTriggers: { getRadius: [tIndex], getFillColor: [tIndex], getLineColor: [tIndex] },
    }));
    // Only the affected sites are named, and only a few of those. An earthquake
    // hits every facility in the area at once, so "name the affected ones" thins
    // nothing on its own — without a cap and a minimum spacing the labels pile
    // into an unreadable stack. The Facilities panel carries the full list.
    const named = pickFacilityLabels(sites.filter((f) => f.impacted), grid);
    if (named.length) {
      layers.push(new TextLayer({
        id: 'sim-facility-labels',
        data: named,
        getPosition: (f) => [f.lon, f.lat],
        getText: (f) => `${f.name || f.kindLabel}, ${f.detail}`,
        getColor: [255, 255, 255, 230],
        getPixelOffset: [0, -9],
        ...labelStyle,
        getSize: 10,
        updateTriggers: { getText: [tIndex], getPosition: [tIndex] },
      }));
    }
  }

  // The incident itself, last so nothing draws over it.
  layers.push(new ScatterplotLayer({
    id: 'sim-origin',
    data: [{ position: [olon, olat] }],
    stroked: true,
    filled: true,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    getPosition: (d) => d.position,
    getRadius: 4,
    getFillColor: [10, 10, 12, 255],
    getLineColor: [255, 255, 255, 245],
    getLineWidth: 2,
  }));
  layers.push(new TextLayer({
    id: 'sim-origin-label',
    data: [{ position: [olon, olat] }],
    getPosition: (d) => d.position,
    getText: () => ORIGIN_LABEL[hazard] || 'Incident',
    getColor: [255, 255, 255, 245],
    getPixelOffset: [0, -12],
    ...labelStyle,
    getSize: 10,
  }));

  return layers;
}
