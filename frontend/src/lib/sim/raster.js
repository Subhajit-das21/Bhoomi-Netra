/**
 * Turning scalar fields into things a GPU can draw: a texture for the ground
 * wash, and marching-squares isolines so the wash has edges you can read a
 * value off. The ramps deliberately climb in lightness *and* opacity together,
 * so intensity survives a greyscale printout and a projector in a bright room.
 */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function rampFrom(stops) {
  return (v) => {
    const t = clamp01(v);
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0] || i === stops.length - 1) {
        const [p0, c0] = stops[i - 1];
        const [p1, c1] = stops[i];
        const f = p1 === p0 ? 0 : (t - p0) / (p1 - p0);
        return mix(c0, c1, clamp01(f));
      }
    }
    return stops[stops.length - 1][1];
  };
}

export const RAMPS = {
  fire: rampFrom([
    [0.0, [26, 22, 20]],
    [0.28, [74, 38, 24]],
    [0.5, [168, 62, 22]],
    [0.72, [235, 122, 28]],
    [0.88, [251, 191, 70]],
    [1.0, [255, 244, 214]],
  ]),
  flood: rampFrom([
    [0.0, [8, 28, 42]],
    [0.25, [12, 62, 92]],
    [0.5, [17, 108, 148]],
    [0.72, [34, 168, 200]],
    [0.9, [120, 218, 232]],
    [1.0, [224, 248, 252]],
  ]),
  earthquake: rampFrom([
    [0.0, [22, 20, 42]],
    [0.3, [58, 38, 104]],
    [0.55, [124, 52, 148]],
    [0.75, [198, 68, 118]],
    [0.9, [243, 146, 88]],
    [1.0, [255, 238, 210]],
  ]),
  smoke: rampFrom([
    [0.0, [70, 70, 76]],
    [0.5, [140, 138, 144]],
    [1.0, [226, 226, 230]],
  ]),
};

/**
 * Render a field into a canvas the BitmapLayer can sample.
 * Row 0 of the image is the north edge, so the grid is flipped on the way out.
 */
export function fieldToCanvas(field, size, ramp, opts = {}) {
  const { gamma = 0.85, maxAlpha = 214, cutoff = 0.012, scale = 1 } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  for (let y = 0; y < size; y++) {
    const srcRow = (size - 1 - y) * size;
    const dstRow = y * size;
    for (let x = 0; x < size; x++) {
      const raw = field[srcRow + x] * scale;
      const p = (dstRow + x) * 4;
      if (!(raw > cutoff)) {
        data[p + 3] = 0;
        continue;
      }
      const v = Math.pow(clamp01(raw), gamma);
      const [r, g, b] = ramp(v);
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = Math.round(Math.min(maxAlpha, 40 + v * (maxAlpha - 40)));
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Marching squares over the cell-centre lattice. Returns one flat list of
 * two-point segments per threshold — the PathLayer is happy with segments and
 * stitching them into rings would buy nothing but a slower frame.
 */
export function contourSegments(field, grid, thresholds) {
  const { size } = grid;
  const out = [];
  const lonAt = (fx) => grid.west + (fx + 0.5) * grid.lonPerCell;
  const latAt = (fy) => grid.south + (fy + 0.5) * grid.latPerCell;

  for (const threshold of thresholds) {
    const segments = [];
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const v00 = field[y * size + x];
        const v10 = field[y * size + x + 1];
        const v11 = field[(y + 1) * size + x + 1];
        const v01 = field[(y + 1) * size + x];
        let code = 0;
        if (v00 >= threshold) code |= 1;
        if (v10 >= threshold) code |= 2;
        if (v11 >= threshold) code |= 4;
        if (v01 >= threshold) code |= 8;
        if (code === 0 || code === 15) continue;

        const lerpT = (a, b) => (Math.abs(b - a) < 1e-9 ? 0.5 : (threshold - a) / (b - a));
        const bottom = () => [lonAt(x + lerpT(v00, v10)), latAt(y)];
        const right = () => [lonAt(x + 1), latAt(y + lerpT(v10, v11))];
        const top = () => [lonAt(x + lerpT(v01, v11)), latAt(y + 1)];
        const left = () => [lonAt(x), latAt(y + lerpT(v00, v01))];

        const push = (a, b) => segments.push([a, b]);
        switch (code) {
          case 1: case 14: push(left(), bottom()); break;
          case 2: case 13: push(bottom(), right()); break;
          case 3: case 12: push(left(), right()); break;
          case 4: case 11: push(right(), top()); break;
          case 6: case 9: push(bottom(), top()); break;
          case 7: case 8: push(left(), top()); break;
          case 5: push(left(), top()); push(bottom(), right()); break;
          case 10: push(left(), bottom()); push(right(), top()); break;
          default: break;
        }
      }
    }
    out.push({ threshold, segments });
  }
  return out;
}

/** The square footprint of one grid cell, for extruded columns. */
export function cellPolygon(grid, gi) {
  const x = gi % grid.size;
  const y = (gi - x) / grid.size;
  const w = grid.west + x * grid.lonPerCell;
  const s = grid.south + y * grid.latPerCell;
  const e = w + grid.lonPerCell;
  const nn = s + grid.latPerCell;
  return [[w, s], [e, s], [e, nn], [w, nn], [w, s]];
}
