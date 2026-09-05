import { fbm2D, mulberry32, seedFromLocation } from './random';
import { ringAreaM2 } from './exposure';

/**
 * Where the scene comes from.
 *
 * First choice is the basemap's own vector tiles — they are already downloaded
 * for the view the operator is looking at, they carry building height and road
 * class, and they cost no extra request. When they are unavailable (no token,
 * zoomed too far out, a style without those layers) we fall back to a procedural
 * town so the simulation still has structures to damage. The UI always says
 * which of the two it is; a plausible-looking invented city presented as survey
 * data would be the worst outcome here.
 */

const ROAD_CLASSES = new Set([
  'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link',
  'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'street', 'street_limited',
  'residential', 'service', 'path', 'pedestrian',
]);

// Firebreak / routing weight by class: a six-lane trunk road stops a grass fire,
// a service lane does not.
const ROAD_WEIGHT = {
  motorway: 1.0, trunk: 0.95, primary: 0.8, secondary: 0.62,
  tertiary: 0.45, street: 0.3, residential: 0.3, service: 0.18, path: 0.08, pedestrian: 0.1,
};

const normaliseClass = (c) => (c || 'street').replace(/_link$|_limited$/, '');

const FACILITY_FROM_MAKI = {
  hospital: 'hospital', doctor: 'clinic', pharmacy: 'clinic', school: 'school',
  college: 'college', university: 'university', police: 'police', 'fire-station': 'fire_station',
  'town-hall': 'shelter', place_of_worship: 'shelter', religious_christian: 'shelter',
  religious_muslim: 'shelter', religious_hindu: 'shelter',
};

const FACILITY_LABELS = {
  hospital: 'Hospital', clinic: 'Clinic', school: 'School', college: 'College',
  university: 'University', police: 'Police', fire_station: 'Fire station', shelter: 'Hall / shelter',
};

export const FACILITY_LABEL = FACILITY_LABELS;

const M_PER_DEG_LAT = 110574;
const mPerDegLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

function centroidOfRing(ring) {
  let lon = 0;
  let lat = 0;
  for (const p of ring) {
    lon += p[0];
    lat += p[1];
  }
  return [lon / ring.length, lat / ring.length];
}

function inBounds(grid, lon, lat) {
  return lon >= grid.west && lon <= grid.east && lat >= grid.south && lat <= grid.north;
}

/** Some styles rename the source; find whichever vector source answers. */
function sourceIdsFor(map) {
  const ids = ['composite'];
  try {
    const style = map.getStyle();
    for (const [id, src] of Object.entries(style?.sources || {})) {
      if (src.type === 'vector' && !ids.includes(id)) ids.push(id);
    }
  } catch {
    // Style not ready yet — 'composite' is still worth a try.
  }
  return ids;
}

function queryLayer(map, sourceLayer) {
  for (const sourceId of sourceIdsFor(map)) {
    try {
      const feats = map.querySourceFeatures(sourceId, { sourceLayer });
      if (feats && feats.length) return feats;
    } catch {
      // Wrong source for this layer; try the next one.
    }
  }
  return [];
}

/** Every outer ring of a Polygon / MultiPolygon; holes are dropped. */
function outerRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.slice(0, 1);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((poly) => poly[0]);
  return [];
}

function lineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

/**
 * A closed ring a fixed distance either side of a centreline.
 *
 * Waterways arrive as lines, but the flood model needs an area it can treat as
 * standing water. Offsetting each vertex along the segment normal and walking
 * back down the other side is crude — it self-intersects on hairpins — and that
 * is acceptable, because all we do with the ring is rasterise it.
 */
function bandAroundLine(line, halfWidthM, latRef) {
  const mx = mPerDegLon(latRef);
  const left = [];
  const right = [];
  for (let i = 0; i < line.length; i++) {
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    let dx = (next[0] - prev[0]) * mx;
    let dy = (next[1] - prev[1]) * M_PER_DEG_LAT;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const nx = (-dy * halfWidthM) / mx;
    const ny = (dx * halfWidthM) / M_PER_DEG_LAT;
    left.push([line[i][0] + nx, line[i][1] + ny]);
    right.push([line[i][0] - nx, line[i][1] - ny]);
  }
  right.reverse();
  const ring = left.concat(right);
  ring.push(ring[0]);
  return ring;
}

function harvestBuildings(map, grid) {
  const seen = new Set();
  const out = [];
  for (const f of queryLayer(map, 'building')) {
    const p = f.properties || {};
    if (p.underground === 'true' || p.extrude === 'false') continue;
    for (const ring of outerRings(f.geometry)) {
      if (ring.length < 4) continue;
      const centroid = centroidOfRing(ring);
      if (!inBounds(grid, centroid[0], centroid[1])) continue;
      // Tiles clip footprints at their edges, so the same building arrives more
      // than once. The feature id is stable across tiles; a quantised centroid
      // is the fallback when the style strips ids.
      const key = f.id != null
        ? `b${f.id}`
        : `c${Math.round(centroid[0] * 2e5)}:${Math.round(centroid[1] * 2e5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const areaM2 = ringAreaM2(ring, centroid[1]);
      if (areaM2 < 12 || areaM2 > 4e5) continue;
      out.push({
        ring,
        centroid,
        areaM2,
        heightM: Number(p.height) || 0,
        baseM: Number(p.min_height) || 0,
        kind: null,
        name: null,
      });
    }
  }
  return out;
}

function harvestRoads(map, grid) {
  const seen = new Set();
  const out = [];
  for (const f of queryLayer(map, 'road')) {
    const p = f.properties || {};
    if (!ROAD_CLASSES.has(p.class)) continue;
    if (p.structure === 'tunnel') continue;
    for (const line of lineStrings(f.geometry)) {
      const coords = line.filter(([lon, lat]) => inBounds(grid, lon, lat));
      if (coords.length < 2) continue;
      const last = coords[coords.length - 1];
      const key = `${Math.round(coords[0][0] * 3e4)}:${Math.round(coords[0][1] * 3e4)}:`
        + `${Math.round(last[0] * 3e4)}:${Math.round(last[1] * 3e4)}:${coords.length}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cls = normaliseClass(p.class);
      out.push({
        coords,
        cls,
        name: p.name || null,
        weight: ROAD_WEIGHT[cls] ?? 0.3,
        bridge: p.structure === 'bridge',
      });
    }
  }
  return out;
}

/** Water as polygons the flood model can treat as its source. */
function harvestWater(map, grid) {
  const polygons = [];
  for (const f of queryLayer(map, 'water')) {
    for (const ring of outerRings(f.geometry)) {
      if (ring.length < 4) continue;
      const c = centroidOfRing(ring);
      if (!inBounds(grid, c[0], c[1])) continue;
      polygons.push([ring]);
    }
  }
  for (const f of queryLayer(map, 'waterway')) {
    for (const line of lineStrings(f.geometry)) {
      const coords = line.filter(([lon, lat]) => inBounds(grid, lon, lat));
      if (coords.length < 2) continue;
      const cls = f.properties?.class;
      const halfWidth = cls === 'river' ? 22 : cls === 'canal' ? 12 : 6;
      polygons.push([bandAroundLine(coords, halfWidth, grid.centerLat)]);
    }
  }
  return polygons;
}

/** Hospitals, schools, police, fire stations — who we protect and where we send people. */
function harvestFacilities(map, grid) {
  const seen = new Set();
  const out = [];
  for (const f of queryLayer(map, 'poi_label')) {
    const p = f.properties || {};
    const kind = FACILITY_FROM_MAKI[p.maki];
    if (!kind) continue;
    const g = f.geometry;
    if (g?.type !== 'Point') continue;
    const [lon, lat] = g.coordinates;
    if (!inBounds(grid, lon, lat)) continue;
    const key = `${p.name || kind}:${Math.round(lon * 2e4)}:${Math.round(lat * 2e4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ lon, lat, kind, kindLabel: FACILITY_LABELS[kind], name: p.name || null });
  }
  return out;
}

/**
 * Give each facility its grid cell, and hand its kind to the footprint it sits
 * in so the hospital renders as a hospital rather than as one more grey block.
 */
function locateFacilities(grid, facilities, buildings) {
  const mx = mPerDegLon(grid.centerLat);
  return facilities.map((f) => {
    const gx = grid.xOf(f.lon);
    const gy = grid.yOf(f.lat);
    const inside = gx >= 0 && gy >= 0 && gx < grid.size && gy < grid.size;
    let nearest = -1;
    let bestD = 45;
    for (let i = 0; i < buildings.length; i++) {
      const c = buildings[i].centroid;
      const d = Math.hypot((c[0] - f.lon) * mx, (c[1] - f.lat) * M_PER_DEG_LAT);
      if (d < bestD) {
        bestD = d;
        nearest = i;
      }
    }
    if (nearest >= 0) {
      buildings[nearest].kind = f.kind;
      buildings[nearest].name = buildings[nearest].name || f.name;
    }
    return { ...f, gi: inside ? gy * grid.size + gx : -1, buildingIndex: nearest };
  });
}

/**
 * A stand-in town, for when the basemap gives us nothing to burn or flood.
 *
 * Deliberately generic: a street lattice, blocks of plots facing the streets,
 * taller frames towards the middle, and one watercourse across the domain. It
 * is seeded from the incident coordinates so the same place always produces the
 * same town, and it is labelled as invented everywhere it is shown.
 */
function proceduralContext(grid) {
  const seed = seedFromLocation(grid.centerLon, grid.centerLat, 4242);
  const rng = mulberry32(seed);
  const spanM = grid.size * grid.cellSizeM;
  const mx = mPerDegLon(grid.centerLat);
  const toLon = (xM) => grid.west + xM / mx;
  const toLat = (yM) => grid.south + yM / M_PER_DEG_LAT;

  const avenueGapM = Math.max(120, Math.min(230, spanM / 13));
  const streetGapM = avenueGapM * 0.78;
  const nAve = Math.floor(spanM / avenueGapM);
  const nSt = Math.floor(spanM / streetGapM);
  const aveX = [];
  const stY = [];
  for (let i = 0; i <= nAve; i++) aveX.push(i * avenueGapM + (rng() - 0.5) * avenueGapM * 0.18);
  for (let j = 0; j <= nSt; j++) stY.push(j * streetGapM + (rng() - 0.5) * streetGapM * 0.18);

  // The watercourse: a noise-perturbed line across the domain, plus its band.
  const channel = [];
  for (let s = 0; s <= 40; s++) {
    const xM = (s / 40) * spanM;
    const wander = (fbm2D(seed + 55, s / 6, 0.5, 3) - 0.5) * spanM * 0.34;
    channel.push([toLon(xM), toLat(spanM * 0.36 + wander)]);
  }
  const channelWidthM = Math.max(14, Math.min(40, spanM / 90));
  const waterPolygons = [[bandAroundLine(channel, channelWidthM, grid.centerLat)]];
  const distToChannelM = (xM, yM) => {
    let best = Infinity;
    for (const [lon, lat] of channel) {
      const d = Math.hypot((lon - toLon(xM)) * mx, (lat - toLat(yM)) * M_PER_DEG_LAT);
      if (d < best) best = d;
    }
    return best;
  };

  const classFor = (i) => (i % 5 === 0 ? 'primary' : i % 5 === 2 ? 'secondary' : 'residential');
  const roads = [];
  for (let i = 0; i < aveX.length; i++) {
    const coords = [];
    for (let j = 0; j < stY.length; j++) {
      coords.push([toLon(aveX[i] + (rng() - 0.5) * 14), toLat(stY[j])]);
    }
    const cls = classFor(i);
    roads.push({ coords, cls, name: `${i + 1} Avenue`, weight: ROAD_WEIGHT[cls], bridge: false });
  }
  for (let j = 0; j < stY.length; j++) {
    const coords = [];
    for (let i = 0; i < aveX.length; i++) {
      coords.push([toLon(aveX[i]), toLat(stY[j] + (rng() - 0.5) * 14)]);
    }
    const cls = classFor(j + 3);
    roads.push({ coords, cls, name: `${j + 1} Cross Road`, weight: ROAD_WEIGHT[cls], bridge: false });
  }

  // Plots face the streets, so buildings ring each block rather than filling it.
  const buildings = [];
  const halfSpan = spanM / 2;
  for (let i = 0; i < aveX.length - 1; i++) {
    for (let j = 0; j < stY.length - 1; j++) {
      const x0 = aveX[i];
      const x1 = aveX[i + 1];
      const y0 = stY[j];
      const y1 = stY[j + 1];
      const blockW = x1 - x0;
      const blockH = y1 - y0;
      const cols = Math.max(2, Math.round(blockW / 26));
      const rows = Math.max(2, Math.round(blockH / 26));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const edge = c === 0 || r === 0 || c === cols - 1 || r === rows - 1;
          if (!edge && rng() > 0.32) continue;
          if (rng() < 0.14) continue;
          const cxM = x0 + ((c + 0.5) / cols) * blockW;
          const cyM = y0 + ((r + 0.5) / rows) * blockH;
          if (distToChannelM(cxM, cyM) < channelWidthM + 12) continue;

          const coreness = Math.max(0, 1 - Math.hypot(cxM - halfSpan, cyM - halfSpan) / halfSpan);
          const density = fbm2D(seed + 9, cxM / 260, cyM / 260, 3);
          const w = Math.min((blockW / cols) * 0.8, 7 + rng() * 13 + coreness * 9);
          const d = Math.min((blockH / rows) * 0.8, 7 + rng() * 13 + coreness * 9);
          const tall = Math.pow(coreness, 1.5) * density;
          const heightM = tall > 0.34
            ? 12 + tall * 34 + rng() * 6
            : 3.2 + rng() * 3.4 + coreness * 4;
          const ring = [
            [toLon(cxM - w / 2), toLat(cyM - d / 2)],
            [toLon(cxM + w / 2), toLat(cyM - d / 2)],
            [toLon(cxM + w / 2), toLat(cyM + d / 2)],
            [toLon(cxM - w / 2), toLat(cyM + d / 2)],
            [toLon(cxM - w / 2), toLat(cyM - d / 2)],
          ];
          buildings.push({
            ring,
            centroid: [toLon(cxM), toLat(cyM)],
            areaM2: w * d,
            heightM,
            baseM: 0,
            kind: null,
            name: null,
          });
        }
      }
    }
  }

  // A few of the blocks get something worth protecting.
  const wanted = [
    ['hospital', 'Ward hospital'], ['school', 'Girls high school'], ['school', 'Boys high school'],
    ['fire_station', 'Fire station'], ['police', 'Police station'],
    ['shelter', 'Community hall'], ['clinic', 'Health post'],
  ];
  const facilities = [];
  for (let k = 0; k < wanted.length && buildings.length; k++) {
    const idx = Math.floor(((k + 1) / (wanted.length + 1)) * buildings.length);
    const b = buildings[Math.min(buildings.length - 1, idx)];
    const [kind, name] = wanted[k];
    b.kind = kind;
    b.name = name;
    facilities.push({
      lon: b.centroid[0], lat: b.centroid[1], kind, kindLabel: FACILITY_LABELS[kind], name,
    });
  }

  return { buildings, roads, waterPolygons, facilities };
}

/**
 * Collect everything the models need about a place.
 *
 * Call this only once the map is idle at a zoom where footprints exist —
 * `querySourceFeatures` reads the tiles that are actually loaded, and Mapbox
 * does not ship the building layer at low zoom, so harvesting too early returns
 * an empty town and silently drops us onto the fallback.
 *
 * The fallback is all-or-nothing on purpose. Invented buildings dropped onto
 * real streets would sit in the middle of the carriageway, and a half-real
 * scene is harder to caption honestly than a wholly invented one.
 */
export function buildContext(map, grid) {
  let buildings = [];
  let roads = [];
  let waterPolygons = [];
  let facilities = [];

  if (map) {
    try {
      buildings = harvestBuildings(map, grid);
      roads = harvestRoads(map, grid);
      waterPolygons = harvestWater(map, grid);
      facilities = harvestFacilities(map, grid);
    } catch {
      buildings = [];
      roads = [];
      waterPolygons = [];
      facilities = [];
    }
  }

  let source = 'basemap';
  if (buildings.length < 25) {
    const p = proceduralContext(grid);
    buildings = p.buildings;
    roads = p.roads;
    waterPolygons = p.waterPolygons;
    facilities = p.facilities;
    source = 'procedural';
  }

  const located = locateFacilities(grid, facilities, buildings);
  let footprintM2 = 0;
  for (const b of buildings) footprintM2 += b.areaM2;

  return {
    buildings,
    roads,
    waterPolygons,
    // What buildTerrain wants: centrelines with a firebreak weight attached.
    roadLines: roads.map((r) => ({ coordinates: r.coords, weight: r.weight })),
    facilities: located,
    source,
    sourceLabel: source === 'basemap'
      ? 'Building footprints, roads and water from the basemap vector tiles'
      : 'No footprints in the loaded tiles — scene is a seeded stand-in town, not survey data',
    counts: {
      buildings: buildings.length,
      roads: roads.length,
      water: waterPolygons.length,
      facilities: located.length,
      footprintM2,
    },
  };
}
