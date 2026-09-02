/**
 * Web Mercator tile math.
 *
 * This is the whole reason the map can show real streets without a native map
 * module. Every raster tile server on the internet — OSM, Carto, MapTiler,
 * Bhuvan's WMTS — addresses tiles by the same `{z}/{x}/{y}` scheme over the same
 * projection, so once the screen agrees with that projection, tiles and our own
 * SVG marks land on the same ground.
 *
 * Pure functions only. No React, no react-native: this file is the part of the
 * map that can be checked with arithmetic instead of eyes, which matters because
 * a projection that is subtly wrong looks entirely plausible on screen and puts
 * a shelter marker on the wrong side of a canal.
 *
 * Conventions:
 *   - `longitude, latitude` in degrees, WGS84.
 *   - "world pixels" are the flattened globe at a given zoom, `256 * 2^z` across,
 *     origin at the north-west corner (-180 lng, +85.051 lat).
 *   - Screen pixels grow right and *down*, like SVG and like the tile grid.
 */

/** Every provider we would plausibly use serves 256 px tiles. */
export const TILE_SIZE = 256;

/**
 * Mercator cannot represent the poles, so it is cut at the latitude where the
 * projection is exactly square: atan(sinh(pi)) in degrees. Panning is clamped
 * here rather than allowed to run to Infinity.
 */
export const MAX_LATITUDE = 85.051_128_779_806_59;

/**
 * Zoom range.
 *
 * The floor is a district: below z10 a ward-level hazard polygon is a few pixels
 * of colour, which is not information. The ceiling is one house: z18 is about
 * 0.6 m per pixel here, and most free tile servers stop at 18 or 19 anyway, so
 * asking for more would fetch blank tiles.
 */
export const MIN_ZOOM = 10;
export const MAX_ZOOM = 18;

/** Metres per pixel at the equator at z0. The standard Mercator constant. */
const EQUATOR_METRES_PER_PIXEL = 156_543.033_928_040_9;

export interface LngLat {
  longitude: number;
  latitude: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface MapCamera {
  centre: LngLat;
  /**
   * Fractional. Tiles are fetched at an integer zoom and scaled, which is how
   * every slippy map handles a pinch mid-gesture.
   */
  zoom: number;
}

export interface Bounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// ---------------------------------------------------------------------------
// The projection itself
// ---------------------------------------------------------------------------

/** World pixel X. Linear in longitude, which is why east-west panning is trivial. */
export function worldX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

/**
 * World pixel Y. The `asinh(tan(lat))` is the Mercator part — the reason a
 * degree of latitude covers more pixels near the poles than at the equator, and
 * the reason you cannot fake this with a linear fit and hope tiles line up.
 */
export function worldY(latitude: number, zoom: number): number {
  const rad = (clampLatitude(latitude) * Math.PI) / 180;
  return (
    ((1 - Math.asinh(Math.tan(rad)) / Math.PI) / 2) * TILE_SIZE * 2 ** zoom
  );
}

export function lngAtWorldX(x: number, zoom: number): number {
  return (x / (TILE_SIZE * 2 ** zoom)) * 360 - 180;
}

export function latAtWorldY(y: number, zoom: number): number {
  const n = Math.PI * (1 - (2 * y) / (TILE_SIZE * 2 ** zoom));
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
}

/**
 * Ground distance one screen pixel covers. Latitude-dependent: the same zoom is
 * a coarser map in Kolkata than in Kashmir. Used to draw the GPS accuracy ring
 * at its true radius, so a 200 m fix visibly does not promise where you are.
 */
export function metresPerPixel(latitude: number, zoom: number): number {
  const rad = (clampLatitude(latitude) * Math.PI) / 180;
  return (EQUATOR_METRES_PER_PIXEL * Math.cos(rad)) / 2 ** zoom;
}

/**
 * A callable projection, so that every mark drawn on this map — zone rings,
 * shelter pins, the user dot — takes one function and needs to know nothing
 * about tiles, zoom or Mercator.
 */
export interface Projection {
  (lng: number, lat: number): { x: number; y: number };
  /** Screen point back to a coordinate. Needed to anchor a pinch under the fingers. */
  unproject(x: number, y: number): LngLat;
  /** At the camera centre, at this camera's fractional zoom. */
  metresPerPixel: number;
  zoom: number;
}

export function buildProjection(
  camera: MapCamera,
  viewport: Viewport,
): Projection {
  const { zoom } = camera;
  const originX = worldX(camera.centre.longitude, zoom) - viewport.width / 2;
  const originY = worldY(camera.centre.latitude, zoom) - viewport.height / 2;

  const project = ((lng: number, lat: number) => ({
    x: worldX(lng, zoom) - originX,
    y: worldY(lat, zoom) - originY,
  })) as Projection;

  project.unproject = (x: number, y: number) => ({
    longitude: lngAtWorldX(x + originX, zoom),
    latitude: latAtWorldY(y + originY, zoom),
  });
  project.metresPerPixel = metresPerPixel(camera.centre.latitude, zoom);
  project.zoom = zoom;

  return project;
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

/** Bounding box of everything that must stay on screen. */
export function boundsOf(points: LngLat[]): Bounds | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
  }
  return { minLng, minLat, maxLng, maxLat };
}

/**
 * The camera that shows all of `bounds` with room to breathe.
 *
 * Fractional zoom on purpose: rounding down to an integer here would leave up to
 * half the screen empty, and on a phone that is the difference between reading a
 * street name and not.
 *
 * Note the centre latitude is the *Mercator* midpoint, not the average of the
 * two latitudes. At ward scale the two differ by well under a pixel, but the
 * average is wrong and wrong things compound.
 */
export function fitCamera(
  bounds: Bounds,
  viewport: Viewport,
  padding = 28,
): MapCamera {
  const usableW = Math.max(1, viewport.width - padding * 2);
  const usableH = Math.max(1, viewport.height - padding * 2);

  // Spans measured at z0, where the whole world is 256 px.
  const spanX = worldX(bounds.maxLng, 0) - worldX(bounds.minLng, 0);
  const spanY = worldY(bounds.minLat, 0) - worldY(bounds.maxLat, 0);

  // A zero span (one point, or a degenerate zone) means "as close as allowed"
  // rather than a division blowing up into NaN.
  const zoomX = spanX > 0 ? Math.log2(usableW / spanX) : MAX_ZOOM;
  const zoomY = spanY > 0 ? Math.log2(usableH / spanY) : MAX_ZOOM;

  return {
    centre: {
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      latitude: latAtWorldY(
        (worldY(bounds.minLat, 0) + worldY(bounds.maxLat, 0)) / 2,
        0,
      ),
    },
    zoom: clampZoom(Math.min(zoomX, zoomY)),
  };
}

/** Drag the map by a screen delta. Positive `dx` moves the ground right. */
export function panCamera(
  camera: MapCamera,
  dx: number,
  dy: number,
): MapCamera {
  const { zoom } = camera;
  return {
    centre: {
      longitude: wrapLongitude(
        lngAtWorldX(worldX(camera.centre.longitude, zoom) - dx, zoom),
      ),
      latitude: clampLatitude(
        latAtWorldY(worldY(camera.centre.latitude, zoom) - dy, zoom),
      ),
    },
    zoom,
  };
}

/**
 * Zoom while keeping whatever is under `focus` under `focus`. That anchoring is
 * the difference between a pinch that feels like handling a map and one that
 * feels like the map is fighting you: without it, the point between your fingers
 * slides away as you spread them.
 */
export function zoomCameraAround(
  camera: MapCamera,
  viewport: Viewport,
  focus: { x: number; y: number },
  nextZoom: number,
): MapCamera {
  const zoom = clampZoom(nextZoom);
  if (zoom === camera.zoom) return camera;

  const anchor = buildProjection(camera, viewport).unproject(focus.x, focus.y);

  // Solve for the centre that puts `anchor` back at `focus` at the new zoom.
  const centreWorldX = worldX(anchor.longitude, zoom) - focus.x + viewport.width / 2;
  const centreWorldY = worldY(anchor.latitude, zoom) - focus.y + viewport.height / 2;

  return {
    centre: {
      longitude: wrapLongitude(lngAtWorldX(centreWorldX, zoom)),
      latitude: clampLatitude(latAtWorldY(centreWorldY, zoom)),
    },
    zoom,
  };
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export interface TileRef {
  /** Stable across a pan, so React keeps the already-loaded <Image> mounted. */
  key: string;
  z: number;
  x: number;
  y: number;
  /** Screen-space placement, already scaled for the fractional part of the zoom. */
  left: number;
  top: number;
  size: number;
}

/**
 * Which integer zoom to fetch tiles at.
 *
 * Floor, not round — so tiles are always drawn at or above their native size,
 * never shrunk. Rounding would keep them sharper on average, but half the time
 * it would render 256 px of tile into ~180 px of screen, and the first casualty
 * of that is the baked-in street label. Slightly soft text a person can read
 * beats crisp text they cannot.
 */
export function tileZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(zoom)));
}

/** Every tile touching the viewport, with where to put it. */
export function visibleTiles(
  camera: MapCamera,
  viewport: Viewport,
): TileRef[] {
  const z = tileZoom(camera.zoom);
  const scale = 2 ** (camera.zoom - z);
  const size = TILE_SIZE * scale;
  const n = 2 ** z;

  // Viewport corners in world pixels at the *tile* zoom.
  const originX =
    worldX(camera.centre.longitude, z) - viewport.width / 2 / scale;
  const originY =
    worldY(camera.centre.latitude, z) - viewport.height / 2 / scale;

  const firstX = Math.floor(originX / TILE_SIZE);
  const lastX = Math.floor((originX + viewport.width / scale) / TILE_SIZE);
  const firstY = Math.floor(originY / TILE_SIZE);
  const lastY = Math.floor((originY + viewport.height / scale) / TILE_SIZE);

  const tiles: TileRef[] = [];
  for (let x = firstX; x <= lastX; x++) {
    for (let y = firstY; y <= lastY; y++) {
      // There is no map above the north pole or below the south, but the world
      // does wrap east to west.
      if (y < 0 || y >= n) continue;
      tiles.push({
        key: `${z}/${x}/${y}`,
        z,
        x: ((x % n) + n) % n,
        y,
        left: (x * TILE_SIZE - originX) * scale,
        top: (y * TILE_SIZE - originY) * scale,
        size,
      });
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MAX_ZOOM;
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

export function clampLatitude(latitude: number): number {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude));
}

/**
 * Longitude back into -180..180. The early return is not an optimisation: the
 * modular form is not exactly an identity in floating point (88.361 comes out as
 * 88.36099999999999), and this runs on every frame of a pan, so a lossy identity
 * would slowly walk the map westward while the finger sits still.
 */
export function wrapLongitude(longitude: number): number {
  if (longitude >= -180 && longitude <= 180) return longitude;
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}
