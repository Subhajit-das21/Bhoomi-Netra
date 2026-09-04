import type { Manoeuvre, RiskZone, RouteStep } from './types';

/**
 * The pure half of flood-aware routing: what we send, and what we make of what
 * comes back.
 *
 * Split from services/routing.ts on the same argument as domain/sms.ts. The
 * network call cannot be exercised in this environment — no key, no egress — so
 * every part of this feature that *can* be checked by hand is put where plain
 * Node can import it and scripts/check-domain.js can assert it. What is left in
 * the service is a fetch, a timeout and a header.
 *
 * The one transformation here that no routing engine can do for itself is
 * `avoidPolygons`. Everything else is bookkeeping.
 */

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

/** Why there are no generated directions, in terms the screen can render. */
export type RoutingFailure =
  /** No `EXPO_PUBLIC_ORS_KEY` in this build. Not an error, just not configured. */
  | 'unconfigured'
  /** Refused, timed out, or the service answered with something unusable. */
  | 'unreachable'
  /**
   * The router looked and there is no walk. Usually because the avoided zones
   * enclose the user, which is a sentence worth putting on screen — quite
   * different from the service being down.
   */
  | 'no-path';

export type RoutingResult =
  | { ok: true; steps: RouteStep[]; path: RoutePoint[] }
  | { ok: false; reason: RoutingFailure };

/**
 * The live risk zones, as one MultiPolygon the router must not cross.
 *
 * Rings are closed here because data/queries.ts drops the duplicate closing point
 * PostGIS emits and GeoJSON requires it back. Degenerate rings are skipped rather
 * than sent: ORS rejects an entire request on one bad ring, and losing the whole
 * route over a two-point zone that was never going to change it is the wrong
 * trade.
 *
 * `options` is omitted entirely when there is nothing to avoid, rather than sent
 * as an empty MultiPolygon — an empty one is a validation error, and "no zones are
 * active" is the ordinary state of a dry day.
 *
 * Coordinates stay lng-first the whole way through. That is the order PostGIS
 * gives us, the order `RiskZone.polygon` stores, and the order ORS wants, so
 * nothing in this file transposes anything.
 */
export function avoidPolygons(zones: RiskZone[]): Record<string, unknown> {
  const polygons = zones
    .map((zone) => zone.polygon)
    .filter((ring) => ring.length >= 3)
    .map((ring) => [[...ring, ring[0]]]);

  if (polygons.length === 0) return {};
  return {
    options: {
      avoid_polygons: { type: 'MultiPolygon', coordinates: polygons },
    },
  };
}

/** The request body, kept here so the shape is assertable without a network. */
export function directionsBody(
  from: RoutePoint,
  to: RoutePoint,
  avoid: RiskZone[],
): Record<string, unknown> {
  return {
    coordinates: [
      [from.longitude, from.latitude],
      [to.longitude, to.latitude],
    ],
    instructions: true,
    units: 'm',
    ...avoidPolygons(avoid),
  };
}

interface OrsStep {
  instruction?: string;
  distance?: number;
  type?: number;
}

interface OrsBody {
  features?: {
    geometry?: { coordinates?: [number, number][] };
    properties?: { segments?: { steps?: OrsStep[] }[] };
  }[];
  error?: { code?: number };
}

/**
 * ORS GeoJSON → the same `RouteStep[]` the surveyed table produces.
 *
 * Deliberately the same type. The screen must not have to learn where its
 * directions came from in order to draw them, or every future change to
 * ShelterRoute has to be made twice. Provenance is carried alongside instead,
 * because the reader is owed it — a human walked this street, or a machine read a
 * map — and that is a sentence, not a branch in the layout.
 *
 * A 200 carrying something unrecognisable resolves to `no-path` rather than
 * throwing. This whole feature is an upgrade on a compass bearing the screen can
 * already draw, so there is no failure here worth an exception: every road leads
 * back to the fallback.
 */
export function parseOrsRoute(body: unknown): RoutingResult {
  const feature = (body as OrsBody)?.features?.[0];

  const steps: RouteStep[] = (feature?.properties?.segments?.[0]?.steps ?? [])
    .filter((step) => typeof step.instruction === 'string' && step.instruction !== '')
    .map((step) => ({
      manoeuvre: manoeuvreOf(step.type),
      instruction: step.instruction as string,
      distance_metres: Math.round(step.distance ?? 0),
    }));

  if (steps.length === 0) return { ok: false, reason: 'no-path' };

  return {
    ok: true,
    steps,
    // Back to lat/lng here, once, because every mark this app draws on a map takes
    // that order. Non-finite pairs are dropped rather than passed on: one NaN in a
    // path blanks an entire SVG layer.
    path: (feature?.geometry?.coordinates ?? [])
      .filter(
        (pair) =>
          Array.isArray(pair) &&
          Number.isFinite(pair[0]) &&
          Number.isFinite(pair[1]),
      )
      .map(([lng, lat]) => ({ latitude: lat, longitude: lng })),
  };
}

/**
 * A non-200 from ORS, read as one of two different sentences.
 *
 * Worth the effort of looking inside the body: "there is no dry way out of here"
 * and "the routing service is down" lead a person to do different things, and
 * collapsing both into one error would hide the first behind the second. ORS
 * carries a numeric code — 2009 is no route between the points, 2010 is a point
 * with no walkable road near it, and both mean the router looked and found
 * nothing.
 *
 * Those two numbers come from the v2 error table and have not been seen in a live
 * response from this environment. Anything unrecognised falls through to
 * `unreachable`, which is the safe way round: it invites a retry, where a wrong
 * `no-path` would tell somebody there is no route out when there may well be one.
 */
export function orsFailure(body: unknown): RoutingFailure {
  const code = (body as OrsBody)?.error?.code;
  return code === 2009 || code === 2010 ? 'no-path' : 'unreachable';
}

/**
 * ORS instruction codes → the five arrows this app draws.
 *
 * Fourteen codes collapse to five shapes on purpose. "Sharp left", "left" and
 * "keep left" are one instruction to somebody walking in the rain holding a
 * phone, and a distinct glyph for each would be five more shapes to learn for no
 * decision. Anything unrecognised becomes `straight`, which is the safe default:
 * an arrow reading carry-on beside text reading turn-left sends nobody into a
 * canal, whereas a guessed turn does.
 */
function manoeuvreOf(type: number | undefined): Manoeuvre {
  switch (type) {
    case 11:
      return 'start';
    case 10:
      return 'arrive';
    case 0:
    case 2:
    case 4:
    case 12:
      return 'left';
    case 1:
    case 3:
    case 5:
    case 13:
      return 'right';
    default:
      return 'straight';
  }
}
