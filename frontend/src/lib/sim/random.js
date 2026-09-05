/**
 * Deterministic noise and pseudo-randomness for the hazard models.
 *
 * Everything here is seeded from the incident coordinates, so the same place
 * always produces the same terrain and the same fire fingers. A demo that
 * reshuffles itself every time you click is impossible to talk over, and an
 * operator who re-runs a scenario has to get the same answer twice.
 */

/** 32-bit integer hash. Cheap, well-mixed enough for noise lattices. */
export function hash32(x, y = 0, z = 0) {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}

/** Seed a location so two incidents 100 m apart get different terrain. */
export function seedFromLocation(lon, lat, salt = 0) {
  return hash32(Math.round(lon * 10000), Math.round(lat * 10000), salt);
}

/** Mulberry32 — small, fast, good enough distribution for Monte Carlo cells. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stateless uniform in [0,1) from a coordinate triple — order-independent. */
export function rand01(seed, x, y, z = 0) {
  return hash32(x + seed, y - seed, z) / 4294967296;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/** Value noise on an integer lattice, smoothstep-interpolated. */
export function valueNoise2D(seed, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = fade(x - xi);
  const ty = fade(y - yi);
  const v00 = rand01(seed, xi, yi);
  const v10 = rand01(seed, xi + 1, yi);
  const v01 = rand01(seed, xi, yi + 1);
  const v11 = rand01(seed, xi + 1, yi + 1);
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}

/** Fractal sum of value noise. Returns roughly 0..1. */
export function fbm2D(seed, x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise2D(seed + o * 7919, fx, fy);
    norm += amp;
    amp *= gain;
    fx *= lacunarity;
    fy *= lacunarity;
  }
  return sum / norm;
}

/**
 * Ridged noise — folds the fbm around its midpoint so the maxima form
 * continuous lines rather than blobs. Used to carve drainage channels, which
 * is what actually decides where floodwater goes on flat deltaic ground.
 */
export function ridged2D(seed, x, y, octaves = 4) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let fx = x;
  let fy = y;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(valueNoise2D(seed + o * 6151, fx, fy) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    fx *= 2.0;
    fy *= 2.0;
  }
  return sum / norm;
}

/** Box–Muller normal deviate, for fragility sampling. */
export function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Standard normal CDF (Abramowitz & Stegun 26.2.17). Fragility curves need it. */
export function normalCdf(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
}
