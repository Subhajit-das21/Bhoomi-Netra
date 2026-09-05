/**
 * Geometry and formatting helpers.
 *
 * Distances are computed rather than hardcoded so that fixture numbers cannot
 * drift away from fixture coordinates — a shelter that says "400 m" while
 * sitting 2 km away is worse than no number at all.
 *
 * Anything that returns words takes a `Language`, defaulting to English. The
 * default is what keeps this file usable from a call site that has no household
 * profile to read a language off — and, while Bengali and Hindi are being written,
 * it is also the marker for a screen nobody has translated yet.
 */
import { t } from './i18n';
import type { Language } from './types';

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
export function formatDistance(metres: number, lang: Language = 'en'): string {
  if (metres < 1000) {
    return t(lang, '{n} m', { n: Math.round(metres / 10) * 10 });
  }
  return t(lang, '{n} km', { n: (metres / 1000).toFixed(1) });
}

/**
 * A pair of coordinates as a place name, for when there is no place name.
 *
 * The fallback for `UserPosition.locality` whenever the reverse geocoder has not
 * answered — which during a flood is the likely case, since it needs the same
 * network the alerts do. Four decimal places is about 11 m, finer than any fix
 * this app will act on, and deliberately in Latin digits in every language:
 * these end up read aloud down a phone line to a control room.
 *
 * Not translated and not localised. A coordinate is the one part of an SOS that
 * has to survive being retyped by somebody who does not read the sender's
 * language.
 */
export function coordinateLabel(p: LatLng): string {
  return `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`;
}

/** Walking time at 4.5 km/h, the pace of someone carrying a bag in a hurry. */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 75));
}

/** Initial great-circle bearing from one point to another, in degrees from north. */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

/**
 * A bearing as a word. Eight points, not sixteen: nobody has ever found their way
 * out of a flood by heading north-north-east, and "north-east" is a direction a
 * person can actually take from a street corner.
 */
export function compassPoint(degrees: number, lang: Language = 'en'): string {
  const points = [
    'north',
    'north-east',
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
  ];
  return t(lang, points[Math.round(degrees / 45) % 8]);
}

/**
 * Relative time, coarse on purpose. In a disaster "14 min ago" is useful and
 * "14 minutes and 32 seconds ago" is noise.
 */
export function timeAgo(
  iso: string,
  now: number = Date.now(),
  lang: Language = 'en',
): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (seconds < 60) return t(lang, 'just now');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t(lang, '{n} min ago', { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return t(lang, hours === 1 ? '{n} hour ago' : '{n} hours ago', { n: hours });
  }
  const days = Math.round(hours / 24);
  return t(lang, days === 1 ? '{n} day ago' : '{n} days ago', { n: days });
}

/**
 * The same span as a length of time rather than a point in the past: "40 min"
 * where `timeAgo` would say "40 min ago".
 *
 * It exists because "No signal for " + timeAgo(...) reads as "No signal for 40
 * min ago", and the fix that was here before — stripping ' ago' off the end —
 * is a fact about English word order that stops being true the moment the
 * sentence is Bengali. Two separate keys is the only version that survives
 * translation.
 */
export function duration(
  iso: string,
  now: number = Date.now(),
  lang: Language = 'en',
): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t(lang, '{n} min', { n: Math.max(1, minutes) });
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return t(lang, hours === 1 ? '{n} hour' : '{n} hours', { n: hours });
  }
  const days = Math.round(hours / 24);
  return t(lang, days === 1 ? '{n} day' : '{n} days', { n: days });
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
