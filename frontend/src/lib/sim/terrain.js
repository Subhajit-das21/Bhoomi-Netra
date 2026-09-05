import { fbm2D, ridged2D, seedFromLocation } from './random';

/**
 * The regular grid every hazard model runs on, plus the synthetic terrain and
 * land cover underneath it.
 *
 * Two honest caveats that the UI surfaces rather than hides:
 *  - the elevation model is synthetic fractal terrain, not a survey DEM. It
 *    gives plausible drainage, not the real drainage of a real ward.
 *  - land cover is inferred from what the basemap knows (water, roads,
 *    building footprints), so it is only as good as the tiles that loaded.
 */

const EARTH_M_PER_DEG_LAT = 110574;

export function buildGrid(centerLon, centerLat, radiusKm, size = 128) {
  const mPerDegLon = 111320 * Math.cos((centerLat * Math.PI) / 180);
  const spanM = radiusKm * 2000;
  const cellSizeM = spanM / size;
  const lonPerCell = cellSizeM / mPerDegLon;
  const latPerCell = cellSizeM / EARTH_M_PER_DEG_LAT;
  const west = centerLon - (lonPerCell * size) / 2;
  const south = centerLat - (latPerCell * size) / 2;

  return {
    size,
    cellSizeM,
    cellAreaM2: cellSizeM * cellSizeM,
    centerLon,
    centerLat,
    radiusKm,
    lonPerCell,
    latPerCell,
    west,
    south,
    east: west + lonPerCell * size,
    north: south + latPerCell * size,
    // Cell centres, so a column drawn at this point tiles with its neighbours.
    lonOf: (x) => west + (x + 0.5) * lonPerCell,
    latOf: (y) => south + (y + 0.5) * latPerCell,
    xOf: (lon) => Math.floor((lon - west) / lonPerCell),
    yOf: (lat) => Math.floor((lat - south) / latPerCell),
    idx: (x, y) => y * size + x,
    bounds: [west, south, west + lonPerCell * size, south + latPerCell * size],
  };
}

/** Winding-number point-in-ring test in raw lon/lat — good enough at this scale. */
function pointInRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Burn polygon rings into a grid array. Rings after the first are holes. */
export function rasterizePolygons(grid, polygons, out, value = 1) {
  const { size } = grid;
  let painted = 0;
  for (const rings of polygons) {
    if (!rings || !rings.length) continue;
    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;
    for (const [lon, lat] of rings[0]) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const x0 = Math.max(0, grid.xOf(minLon));
    const x1 = Math.min(size - 1, grid.xOf(maxLon) + 1);
    const y0 = Math.max(0, grid.yOf(minLat));
    const y1 = Math.min(size - 1, grid.yOf(maxLat) + 1);
    for (let y = y0; y <= y1; y++) {
      const lat = grid.latOf(y);
      for (let x = x0; x <= x1; x++) {
        const lon = grid.lonOf(x);
        if (!pointInRing(rings[0], lon, lat)) continue;
        let inHole = false;
        for (let h = 1; h < rings.length; h++) {
          if (pointInRing(rings[h], lon, lat)) {
            inHole = true;
            break;
          }
        }
        if (inHole) continue;
        out[y * size + x] = value;
        painted++;
      }
    }
  }
  return painted;
}

/** Burn line strings into a grid array, taking the max of existing and value. */
export function rasterizeLines(grid, lines, out, valueOf) {
  const { size } = grid;
  for (const line of lines) {
    const value = typeof valueOf === 'function' ? valueOf(line) : valueOf;
    const pts = line.coordinates || line;
    for (let i = 1; i < pts.length; i++) {
      const ax = (pts[i - 1][0] - grid.west) / grid.lonPerCell;
      const ay = (pts[i - 1][1] - grid.south) / grid.latPerCell;
      const bx = (pts[i][0] - grid.west) / grid.lonPerCell;
      const by = (pts[i][1] - grid.south) / grid.latPerCell;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
      for (let s = 0; s <= steps; s++) {
        const x = Math.round(ax + ((bx - ax) * s) / steps);
        const y = Math.round(ay + ((by - ay) * s) / steps);
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const k = y * size + x;
        if (value > out[k]) out[k] = value;
      }
    }
  }
}

function boxBlur(src, size, passes = 1) {
  let a = src;
  let b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= size) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= size) continue;
            sum += a[ny * size + nx];
            count++;
          }
        }
        b[y * size + x] = sum / count;
      }
    }
    const swap = a;
    a = b;
    b = swap;
  }
  return a;
}

/**
 * Build the terrain and land-cover stack for one grid.
 *
 * `context` carries whatever the basemap could tell us about this place:
 * water polygons, road centrelines with a class weight, and building
 * footprints. Everything it cannot tell us is synthesised from seeded noise.
 */
export function buildTerrain(grid, context = {}, params = {}) {
  const { size, cellSizeM } = grid;
  const n = size * size;
  const seed = seedFromLocation(grid.centerLon, grid.centerLat);
  const reliefM = params.reliefM ?? 12;
  const baseElevM = 6;

  const water = new Uint8Array(n);
  const roadWeight = new Float32Array(n);
  if (context.waterPolygons?.length) rasterizePolygons(grid, context.waterPolygons, water, 1);
  if (context.roadLines?.length) {
    rasterizeLines(grid, context.roadLines, roadWeight, (l) => l.weight ?? 0.4);
  }

  // Built-up fraction. Real footprints beat noise, so use them when the tiles
  // gave us enough of them; the noise fallback keeps the field continuous when
  // they did not.
  let builtUp = new Float32Array(n);
  const buildings = context.buildings || [];
  if (buildings.length >= 40) {
    for (const b of buildings) {
      const x = grid.xOf(b.centroid[0]);
      const y = grid.yOf(b.centroid[1]);
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      builtUp[y * size + x] += b.areaM2 / grid.cellAreaM2;
    }
    builtUp = boxBlur(builtUp, size, 2);
    let peak = 0;
    for (let i = 0; i < n; i++) if (builtUp[i] > peak) peak = builtUp[i];
    const norm = peak > 0 ? 1 / Math.max(0.25, peak) : 0;
    for (let i = 0; i < n; i++) builtUp[i] = Math.min(1, builtUp[i] * norm);
  } else {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = fbm2D(seed + 101, x / 18, y / 18, 4);
        builtUp[y * size + x] = Math.max(0, Math.min(1, (v - 0.35) * 1.9));
      }
    }
  }

  // Elevation: a seeded regional tilt, fractal relief on top, and ridged
  // channels subtracted to carve drainage. On flat deltaic ground the channels
  // decide where water goes far more than the hills do.
  const tiltAngle = ((seed % 3600) / 3600) * Math.PI * 2;
  const tiltX = Math.cos(tiltAngle) * (reliefM * 0.3);
  const tiltY = Math.sin(tiltAngle) * (reliefM * 0.3);
  const elevation = new Float32Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const hills = fbm2D(seed, x / 26, y / 26, 5);
      const channels = ridged2D(seed + 7, x / 34, y / 34, 4);
      let e =
        baseElevM +
        tiltX * (u - 0.5) * 2 +
        tiltY * (v - 0.5) * 2 +
        reliefM * hills -
        reliefM * 0.6 * channels;
      // Built-up ground in the delta is usually raised fill.
      e += builtUp[y * size + x] * 0.5;
      elevation[y * size + x] = e;
    }
  }

  // Mapped water is the local low point, and it drags its banks down with it,
  // otherwise the flood fill escapes the channel on the first timestep.
  if (context.waterPolygons?.length) {
    const carved = new Float32Array(elevation);
    for (let i = 0; i < n; i++) if (water[i]) carved[i] = elevation[i] - 3.4;
    const smoothed = boxBlur(carved, size, 1);
    for (let i = 0; i < n; i++) {
      elevation[i] = water[i] ? carved[i] : Math.min(elevation[i], smoothed[i] + 0.15);
    }
  }

  let minElev = Infinity;
  let maxElev = -Infinity;
  for (let i = 0; i < n; i++) {
    if (elevation[i] < minElev) minElev = elevation[i];
    if (elevation[i] > maxElev) maxElev = elevation[i];
  }
  const elevSpan = Math.max(0.5, maxElev - minElev);

  // Slope and downhill aspect from central differences.
  const slope = new Float32Array(n);
  const aspect = new Float32Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xl = Math.max(0, x - 1);
      const xr = Math.min(size - 1, x + 1);
      const yd = Math.max(0, y - 1);
      const yu = Math.min(size - 1, y + 1);
      const dzdx = (elevation[y * size + xr] - elevation[y * size + xl]) / ((xr - xl) * cellSizeM);
      const dzdy = (elevation[yu * size + x] - elevation[yd * size + x]) / ((yu - yd) * cellSizeM);
      slope[y * size + x] = Math.atan(Math.hypot(dzdx, dzdy));
      aspect[y * size + x] = Math.atan2(-dzdy, -dzdx);
    }
  }

  // Vegetation is what is left once water and buildings have taken their share.
  const vegetation = new Float32Array(n);
  const manningN = new Float32Array(n);
  const vs30 = new Float32Array(n);
  const popDensity = new Float32Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = y * size + x;
      const wet = water[k] === 1;
      const green = fbm2D(seed + 313, x / 14, y / 14, 4);
      vegetation[k] = wet ? 0 : Math.max(0, Math.min(1, green * 1.25 - builtUp[k] * 0.9));

      manningN[k] = wet ? 0.03 : roadWeight[k] > 0.5 ? 0.018 : builtUp[k] > 0.4 ? 0.075 : 0.045;

      // Soft alluvium sits in the low ground and amplifies shaking there.
      const rel = (elevation[k] - minElev) / elevSpan;
      vs30[k] = Math.max(150, 170 + 330 * rel - (wet ? 30 : 0));

      popDensity[k] = wet ? 0 : Math.min(34000, 700 + 27000 * Math.pow(builtUp[k], 1.15));
    }
  }

  return {
    elevation,
    slope,
    aspect,
    vegetation,
    builtUp,
    water,
    roadWeight,
    manningN,
    vs30,
    popDensity,
    minElev,
    maxElev,
    elevSpan,
    reliefM,
    seed,
    builtUpSource: buildings.length >= 40 ? 'footprints' : 'synthetic',
  };
}
