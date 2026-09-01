/**
 * Geometry and formatting helpers.
 *
 * Distances are computed rather than hardcoded so that fixture numbers cannot
 * drift away from fixture coordinates — a shelter that says "400 m" while
 * sitting 2 km away is worse than no number at all.
 */

const EARTH_RADIUS_M = 6_371_000;

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Great-circle distance in metres. */
export function distanceMetres(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/**
 * Distance a person can act on. Rounded to 10 m under a kilometre because
 * "437 m" implies a precision GPS does not have, and to one decimal above.
 */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Walking time at 4.5 km/h, the pace of someone carrying a bag in a hurry. */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 75));
}

/**
 * Relative time, coarse on purpose. In a disaster "14 min ago" is useful and
 * "14 minutes and 32 seconds ago" is noise.
 */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** Clock time, for "last updated at" where an absolute reference is clearer. */
export function clockTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

/**
 * Ray-casting point-in-polygon. Rings are [lng, lat] to match PostGIS output,
 * so that a future `ST_AsGeoJSON` response can be fed in unchanged.
 */
export function isInsidePolygon(
  point: LatLng,
  ring: [number, number][],
): boolean {
  const { latitude: y, longitude: x } = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to a polygon edge, in metres. 0 if inside. */
export function metresToPolygon(
  point: LatLng,
  ring: [number, number][],
): number {
  if (isInsidePolygon(point, ring)) return 0;
  let best = Infinity;
  for (const [lng, lat] of ring) {
    best = Math.min(best, distanceMetres(point, { latitude: lat, longitude: lng }));
  }
  return best;
}

/** Raw 12-bit ADC count to a percentage of full scale, for gauges. */
export function adcToPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round((value / 4095) * 100)));
}
