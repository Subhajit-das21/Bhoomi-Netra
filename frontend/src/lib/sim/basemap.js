/**
 * Dressing the basemap so the model has a city to stand in.
 *
 * Mapbox's dark style draws footprints as flat fills and paints water almost the
 * same colour as land, which is fine for a label map and useless for judging a
 * flood. So on load we extrude every building the tiles carry, lift water and
 * waterways to something recognisably wet, and pick the bridges out of the road
 * network — a severed bridge is a different problem from a severed street.
 *
 * The extrusions stop at the study square. Inside it the simulation draws its own
 * footprints, shaded by damage, and two extrusions of the same building fighting
 * over the same depth buffer looks exactly as bad as it sounds. The seam is also
 * the honest edge of the model: context outside, computed inside.
 */

const CTX_BUILDINGS = 'ctx-buildings-3d';

/** The style's own vector source, whatever it has been renamed to. */
function buildingSource(map) {
  const style = map.getStyle();
  for (const layer of style?.layers || []) {
    if (layer['source-layer'] === 'building' && layer.source) {
      return { source: layer.source, sourceLayer: 'building' };
    }
  }
  return { source: 'composite', sourceLayer: 'building' };
}

/** Labels last: find the first symbol layer so extrusions slide in underneath. */
function firstSymbolId(map) {
  for (const layer of map.getStyle()?.layers || []) {
    if (layer.type === 'symbol') return layer.id;
  }
  return undefined;
}

function paintIfPresent(map, id, prop, value) {
  if (!map.getLayer(id)) return;
  try {
    map.setPaintProperty(id, prop, value);
  } catch {
    // Style keeps its own schema; a property this style does not have is not
    // worth an exception on the happy path.
  }
}

/**
 * Water the colour of water. Deep enough to read as a surface on a dark map,
 * desaturated enough that the flood wash on top of it still wins.
 */
function dressWater(map) {
  paintIfPresent(map, 'water', 'fill-color', '#0c2b3d');
  paintIfPresent(map, 'water-shadow', 'fill-color', '#081f2c');
  paintIfPresent(map, 'waterway', 'line-color', '#14506b');
  paintIfPresent(map, 'waterway', 'line-width', [
    'interpolate', ['linear'], ['zoom'], 12, 0.8, 16, 3.2, 18, 6,
  ]);
  for (const layer of map.getStyle()?.layers || []) {
    if (layer['source-layer'] === 'water' && layer.type === 'fill' && layer.id !== 'water') {
      paintIfPresent(map, layer.id, 'fill-color', '#0c2b3d');
    }
  }
}

/**
 * Bridges, brightened. Mapbox splits them into their own layers already, so this
 * is only a repaint — but it is the difference between "the road is cut" and
 * "the road is cut and the only crossing went with it".
 */
function dressBridges(map) {
  for (const layer of map.getStyle()?.layers || []) {
    if (layer.type !== 'line' || !layer.id.startsWith('bridge')) continue;
    const casing = layer.id.includes('case');
    paintIfPresent(map, layer.id, 'line-color', casing ? '#0b0d11' : '#8d95a6');
  }
}

/** Buildings everywhere, in a grey that stays out of the way. */
function addContextBuildings(map) {
  if (map.getLayer(CTX_BUILDINGS)) return;
  const { source, sourceLayer } = buildingSource(map);
  if (!map.getSource(source)) return;
  map.addLayer({
    id: CTX_BUILDINGS,
    type: 'fill-extrusion',
    source,
    'source-layer': sourceLayer,
    minzoom: 13.5,
    filter: ['all',
      ['!=', ['get', 'underground'], 'true'],
      ['!=', ['get', 'extrude'], 'false'],
    ],
    paint: {
      // Dark-v11's land sits at 16% grey, so a building painted darker than that
      // reads as a hole rather than a form. These start just above the ground and
      // climb with height; the vertical gradient darkens the walls, which is what
      // gives the block its edge.
      'fill-extrusion-color': [
        'interpolate', ['linear'], ['coalesce', ['get', 'height'], 6],
        0, '#343b45',
        24, '#434c58',
        80, '#55606f',
      ],
      // Grow them in as the tiles arrive rather than popping a wall of blocks
      // into frame the moment the zoom threshold is crossed.
      'fill-extrusion-height': [
        'interpolate', ['linear'], ['zoom'],
        13.5, 0,
        15.2, ['coalesce', ['get', 'height'], 6],
      ],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.85,
      'fill-extrusion-vertical-gradient': true,
    },
  }, firstSymbolId(map));
}

/**
 * Call once the style has loaded. Safe to call again — every step checks first.
 */
export function dressBasemap(map) {
  if (!map || !map.isStyleLoaded?.()) return false;
  try {
    addContextBuildings(map);
    dressWater(map);
    dressBridges(map);
    return true;
  } catch {
    return false;
  }
}

/** Can the map answer with footprints yet, or are the tiles still in flight? */
export function hasFootprints(map) {
  if (!map?.isStyleLoaded?.()) return false;
  const { source, sourceLayer } = buildingSource(map);
  try {
    return map.querySourceFeatures(source, { sourceLayer }).length > 0;
  } catch {
    return false;
  }
}

/**
 * Hide the context extrusions where the model draws its own, using a `within`
 * expression against the study square. Pass null to show them everywhere again.
 */
export function setStudyMask(map, bounds) {
  if (!map || !map.getLayer?.(CTX_BUILDINGS)) return;
  const base = ['all',
    ['!=', ['get', 'underground'], 'true'],
    ['!=', ['get', 'extrude'], 'false'],
  ];
  if (!bounds) {
    try {
      map.setFilter(CTX_BUILDINGS, base);
    } catch { /* style reloading */ }
    return;
  }
  const [west, south, east, north] = bounds;
  const square = {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
  try {
    map.setFilter(CTX_BUILDINGS, [...base, ['!', ['within', square]]]);
  } catch {
    // `within` needs a recent mapbox-gl; without it the worst case is a double
    // extrusion inside the square, which is ugly but not broken.
  }
}
