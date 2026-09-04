/**
 * Framing and projection checks, run under plain Node against the real seed
 * geometry from 006_citizen_tables.sql. No device needed, and no test runner is
 * installed — this exists because a projection that is subtly wrong looks
 * entirely plausible on screen.
 */
const assert = require('assert');

const TILE = 256;
const EQ = 156543.0339280409;
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;
const STREET_ZOOM = 14;
const FOCUS_RADIUS_METRES = 2500;

const worldX = (lng, z) => ((lng + 180) / 360) * TILE * 2 ** z;
const worldY = (lat, z) =>
  ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * TILE * 2 ** z;
const latAtWorldY = (y, z) =>
  (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / (TILE * 2 ** z)))) * 180) / Math.PI;
const mpp = (lat, z) => (EQ * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
const clampZoom = (z) =>
  Number.isFinite(z) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)) : MAX_ZOOM;

function distanceMetres(a, b) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fitCamera(b, vp, padding = 28) {
  const usableW = Math.max(1, vp.width - padding * 2);
  const usableH = Math.max(1, vp.height - padding * 2);
  const spanX = worldX(b.maxLng, 0) - worldX(b.minLng, 0);
  const spanY = worldY(b.minLat, 0) - worldY(b.maxLat, 0);
  const zx = spanX > 0 ? Math.log2(usableW / spanX) : MAX_ZOOM;
  const zy = spanY > 0 ? Math.log2(usableH / spanY) : MAX_ZOOM;
  return {
    centre: {
      longitude: (b.minLng + b.maxLng) / 2,
      latitude: latAtWorldY((worldY(b.minLat, 0) + worldY(b.maxLat, 0)) / 2, 0),
    },
    zoom: clampZoom(Math.min(zx, zy)),
  };
}

// --- the real seed geometry, transcribed from 006_citizen_tables.sql ---------

const POSITION = { latitude: 22.5148, longitude: 88.361 }; // Ward 58, Kolkata

const ZONES = [
  {
    name: 'Ward 58 low-lying lanes',
    hazard_type: 'flood',
    polygon: [
      [88.3555, 22.5105],
      [88.3665, 22.5115],
      [88.3675, 22.5185],
      [88.3565, 22.5175],
      [88.3555, 22.5105],
    ],
  },
  {
    name: 'Hooghly east bank',
    hazard_type: 'flood',
    polygon: [
      [88.3405, 22.5745],
      [88.3515, 22.5765],
      [88.3535, 22.5925],
      [88.3425, 22.5905],
      [88.3405, 22.5745],
    ],
  },
  {
    name: 'Rabindra Sarobar dry scrub',
    hazard_type: 'fire',
    polygon: [
      [88.3545, 22.5075],
      [88.3625, 22.5065],
      [88.3635, 22.5135],
      [88.3555, 22.5145],
      [88.3545, 22.5075],
    ],
  },
];

const SHELTERS = [
  { name: 'Deshapriya Park', latitude: 22.5175, longitude: 88.3585 },
  { name: 'Lake Gardens', latitude: 22.506, longitude: 88.356 },
  { name: 'Netaji Indoor', latitude: 22.5636, longitude: 88.3395 },
  { name: 'Jadavpur Vidyapith', latitude: 22.499, longitude: 88.3695 },
];

/** A phone-ish map viewport: 411dp wide, the map area about 520dp tall. */
const VIEWPORT = { width: 411, height: 520 };

function isInside(point, ring) {
  const { latitude: y, longitude: x } = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function metresToPolygon(point, ring) {
  if (isInside(point, ring)) return 0;
  let best = Infinity;
  for (const [lng, lat] of ring) {
    best = Math.min(best, distanceMetres(point, { latitude: lat, longitude: lng }));
  }
  return best;
}

const boundsOf = (pts) => ({
  minLng: Math.min(...pts.map((p) => p.longitude)),
  maxLng: Math.max(...pts.map((p) => p.longitude)),
  minLat: Math.min(...pts.map((p) => p.latitude)),
  maxLat: Math.max(...pts.map((p) => p.latitude)),
});

function districtBounds() {
  const pts = [POSITION];
  for (const z of ZONES) {
    for (const [longitude, latitude] of z.polygon) pts.push({ longitude, latitude });
  }
  for (const s of SHELTERS) pts.push({ longitude: s.longitude, latitude: s.latitude });
  return boundsOf(pts);
}

function focusBounds(destination) {
  const pts = [POSITION];
  if (destination) {
    pts.push({ longitude: destination.longitude, latitude: destination.latitude });
  }
  for (const z of ZONES) {
    if (metresToPolygon(POSITION, z.polygon) > FOCUS_RADIUS_METRES) continue;
    for (const [longitude, latitude] of z.polygon) pts.push({ longitude, latitude });
  }
  for (const s of SHELTERS) {
    if (distanceMetres(POSITION, s) <= FOCUS_RADIUS_METRES) {
      pts.push({ longitude: s.longitude, latitude: s.latitude });
    }
  }
  if (pts.length < 2) return districtBounds();
  return boundsOf(pts);
}

// --- the opening-frame rule, transcribed from ZoneMap.tsx --------------------

/** Enough to draw a destination marker and its casing ring whole. */
const MARK_MARGIN_PX = 20;

function isOnScreen(camera, vp, point, margin = 0) {
  const originX = worldX(camera.centre.longitude, camera.zoom) - vp.width / 2;
  const originY = worldY(camera.centre.latitude, camera.zoom) - vp.height / 2;
  const x = worldX(point.longitude, camera.zoom) - originX;
  const y = worldY(point.latitude, camera.zoom) - originY;
  return (
    x >= margin &&
    y >= margin &&
    x <= vp.width - margin &&
    y <= vp.height - margin
  );
}

function openingCamera(destination) {
  const wide = fitCamera(focusBounds(destination), VIEWPORT);
  if (wide.zoom >= STREET_ZOOM) return wide;
  const close = { ...wide, zoom: STREET_ZOOM };
  if (!destination) return close;
  return isOnScreen(close, VIEWPORT, destination, MARK_MARGIN_PX) ? close : wide;
}

function visibleTiles(camera, vp) {
  const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(camera.zoom)));
  const scale = 2 ** (camera.zoom - z);
  const size = TILE * scale;
  const n = 2 ** z;
  const originX = worldX(camera.centre.longitude, z) - vp.width / 2 / scale;
  const originY = worldY(camera.centre.latitude, z) - vp.height / 2 / scale;
  const tiles = [];
  for (let x = Math.floor(originX / TILE); x <= Math.floor((originX + vp.width / scale) / TILE); x++) {
    for (let y = Math.floor(originY / TILE); y <= Math.floor((originY + vp.height / scale) / TILE); y++) {
      if (y < 0 || y >= n) continue;
      tiles.push({
        z,
        x: ((x % n) + n) % n,
        y,
        left: (x * TILE - originX) * scale,
        top: (y * TILE - originY) * scale,
        size,
      });
    }
  }
  return tiles;
}

/** `{s}`/`{r}` substitution, transcribed from TileLayer.tsx. */
const SUBDOMAINS = ['a', 'b', 'c', 'd'];
const fillTemplate = (template, t) =>
  template
    .replace('{s}', SUBDOMAINS[(t.x + t.y) % SUBDOMAINS.length])
    .replace('{z}', String(t.z))
    .replace('{x}', String(t.x))
    .replace('{y}', String(t.y))
    .replace('{r}', '');

// --- checks ------------------------------------------------------------------

let failures = 0;

function check(what, fn) {
  try {
    fn();
    console.log(`  ok    ${what}`);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  ${what}\n          ${err.message}`);
  }
}

const near = (actual, expected, tol, what) =>
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${what}: ${actual} is not within ${tol} of ${expected}`,
  );

const metresAcross = (c) => mpp(c.centre.latitude, c.zoom) * VIEWPORT.width;

console.log('\nprojection');

check('z0 is one 256px tile holding the whole world', () => {
  near(worldX(-180, 0), 0, 1e-9, 'west edge');
  near(worldX(180, 0), TILE, 1e-9, 'east edge');
  near(worldY(85.051_128_779_806_59, 0), 0, 1e-9, 'north edge');
  near(worldY(-85.051_128_779_806_59, 0), TILE, 1e-9, 'south edge');
  near(worldX(0, 0), 128, 1e-9, 'prime meridian');
  near(worldY(0, 0), 128, 1e-9, 'equator');
});

check('Ward 58 lands in tile 15/24426/14279', () => {
  // A real tile, checkable against any slippy-map debug page. If this drifts,
  // every mark on the map is drawn over the wrong ground.
  assert.strictEqual(Math.floor(worldX(POSITION.longitude, 15) / TILE), 24426);
  assert.strictEqual(Math.floor(worldY(POSITION.latitude, 15) / TILE), 14279);
});

check('latitude survives the round trip through world pixels', () => {
  for (const z of [10, 12, 14, 15, 18]) {
    near(latAtWorldY(worldY(POSITION.latitude, z), z), POSITION.latitude, 1e-9, `z${z}`);
  }
});

check('a pixel is 4.41 m at z15 over Kolkata, and halves each level', () => {
  near(mpp(POSITION.latitude, 15), 4.4132, 0.001, 'z15');
  near(mpp(POSITION.latitude, 14), 8.8264, 0.001, 'z14');
  near(mpp(POSITION.latitude, 14) / mpp(POSITION.latitude, 15), 2, 1e-12, 'ratio');
});

check('zoom is clamped, and no NaN can reach the camera', () => {
  // One NaN in the camera blanks the entire map, and a pinch is where it would
  // come from — two touch points arriving without coordinates.
  assert.strictEqual(clampZoom(NaN), MAX_ZOOM);
  assert.strictEqual(clampZoom(Infinity), MAX_ZOOM);
  assert.strictEqual(clampZoom(-Infinity), MAX_ZOOM);
  assert.strictEqual(clampZoom(0), MIN_ZOOM);
  assert.strictEqual(clampZoom(99), MAX_ZOOM);
  assert.strictEqual(clampZoom(15.5), 15.5);
});

console.log('\nframing');

check('the district frame is the city-wide one, ~9 km across', () => {
  // This is the frame the map used to open with, and the bug behind the
  // screenshot: the zones are a smudge and no lane has a name.
  const c = fitCamera(districtBounds(), VIEWPORT);
  near(c.zoom, 12.654, 0.01, 'district zoom');
  assert.ok(
    metresAcross(c) > 8000,
    `district frame holds only ${metresAcross(c).toFixed(0)} m across`,
  );
});

check('the focus frame keeps only what is within walking distance', () => {
  near(metresToPolygon(POSITION, ZONES[1].polygon), 6930, 25, 'Hooghly east bank');
  assert.strictEqual(
    metresToPolygon(POSITION, ZONES[0].polygon),
    0,
    'the fixture position should be standing inside Ward 58',
  );
  const kept = ZONES.filter(
    (z) => metresToPolygon(POSITION, z.polygon) <= FOCUS_RADIUS_METRES,
  ).map((z) => z.name);
  assert.deepStrictEqual(kept, [
    'Ward 58 low-lying lanes',
    'Rabindra Sarobar dry scrub',
  ]);
  const kept2 = SHELTERS.filter(
    (s) => distanceMetres(POSITION, s) <= FOCUS_RADIUS_METRES,
  ).map((s) => s.name);
  assert.deepStrictEqual(kept2, [
    'Deshapriya Park',
    'Lake Gardens',
    'Jadavpur Vidyapith',
  ]);
});

check('the opening frame is a neighbourhood you can read street names off', () => {
  const c = openingCamera(null);
  assert.ok(c.zoom >= STREET_ZOOM, `opens at z${c.zoom.toFixed(2)}, below street zoom`);
  assert.ok(
    metresAcross(c) < 2500,
    `opening frame holds ${metresAcross(c).toFixed(0)} m across, which is not a neighbourhood`,
  );
});

check('nothing within walking distance is cropped off the opening frame', () => {
  const c = openingCamera(null);
  assert.ok(isOnScreen(c, VIEWPORT, POSITION), 'you are off your own map');
  for (const s of SHELTERS) {
    if (distanceMetres(POSITION, s) > FOCUS_RADIUS_METRES) continue;
    assert.ok(isOnScreen(c, VIEWPORT, s), `${s.name} is off the opening frame`);
  }
  for (const z of ZONES) {
    if (metresToPolygon(POSITION, z.polygon) > FOCUS_RADIUS_METRES) continue;
    for (const [longitude, latitude] of z.polygon) {
      assert.ok(
        isOnScreen(c, VIEWPORT, { longitude, latitude }),
        `a vertex of ${z.name} is off the opening frame`,
      );
    }
  }
});

check('the street-zoom floor never crops the shelter you are sent to', () => {
  // The case: every near shelter is full, so the recommendation is Netaji
  // Indoor, 5.9 km away. Pulling in to street zoom would push it off screen,
  // leaving a dashed line running off the edge as the only instruction.
  const netaji = SHELTERS[2];
  assert.ok(
    distanceMetres(POSITION, netaji) > FOCUS_RADIUS_METRES,
    'fixture: Netaji Indoor should be outside the focus radius',
  );

  const floored = { ...fitCamera(focusBounds(netaji), VIEWPORT), zoom: STREET_ZOOM };
  assert.ok(
    !isOnScreen(floored, VIEWPORT, netaji, MARK_MARGIN_PX),
    'fixture: the floor should have cropped it, so this check proves nothing',
  );

  const c = openingCamera(netaji);
  assert.ok(
    isOnScreen(c, VIEWPORT, netaji, MARK_MARGIN_PX),
    'the shelter being recommended is off the opening frame',
  );
  assert.ok(isOnScreen(c, VIEWPORT, POSITION, MARK_MARGIN_PX), 'you are off the frame');
  assert.ok(c.zoom < STREET_ZOOM, 'expected the wider frame to have won');
});

console.log('\ntiles');

check('visible tiles cover the screen with no seams, at every pinch position', () => {
  for (const zoom of [10, 12.7, 14, 14.3, 15.7, 17.99, 18]) {
    const c = { centre: POSITION, zoom };
    const tiles = visibleTiles(c, VIEWPORT);
    assert.ok(
      tiles.length >= 4 && tiles.length <= 30,
      `z${zoom}: ${tiles.length} tiles is not a sane count for a phone screen`,
    );
    const probes = [
      [0, 0],
      [VIEWPORT.width - 1, 0],
      [0, VIEWPORT.height - 1],
      [VIEWPORT.width - 1, VIEWPORT.height - 1],
      [VIEWPORT.width / 2, VIEWPORT.height / 2],
    ];
    for (const [x, y] of probes) {
      const covered = tiles.some(
        (t) => x >= t.left && x < t.left + t.size && y >= t.top && y < t.top + t.size,
      );
      assert.ok(covered, `z${zoom}: nothing covers screen point ${x},${y}`);
    }
    for (const t of tiles) {
      assert.ok(t.x >= 0 && t.x < 2 ** t.z, `z${zoom}: tile x ${t.x} out of range`);
      assert.ok(t.y >= 0 && t.y < 2 ** t.z, `z${zoom}: tile y ${t.y} out of range`);
    }
  }
});

check('Esri templates put the row before the column', () => {
  // The one silent failure mode in the whole tile layer: Esri orders the path
  // {z}/{y}/{x}, everyone else {z}/{x}/{y}. Swap them and you get a plausible
  // map of somewhere else entirely.
  const t = { z: 15, x: 24426, y: 14279 };
  assert.strictEqual(
    fillTemplate(
      'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      t,
    ),
    'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/15/14279/24426',
  );
  assert.strictEqual(
    fillTemplate('https://tile.openstreetmap.org/{z}/{x}/{y}.png', t),
    'https://tile.openstreetmap.org/15/24426/14279.png',
  );
  // `{r}` collapses rather than being left as a literal brace and guaranteeing
  // a 404, and `{s}` is picked from the tile's own coordinates — not at random —
  // so the same tile keeps resolving to the same host across a pan.
  assert.strictEqual(
    fillTemplate('https://{s}.example.org/{z}/{x}/{y}{r}.png', t),
    'https://b.example.org/15/24426/14279.png',
  );
});

console.log(
  failures === 0
    ? '\nAll map checks passed.\n'
    : `\n${failures} map check${failures === 1 ? '' : 's'} failed.\n`,
);
process.exitCode = failures === 0 ? 0 : 1;
