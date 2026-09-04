import {
  directionsBody,
  orsFailure,
  parseOrsRoute,
  type RoutePoint,
  type RoutingResult,
} from '../domain/routing';
import type { RiskZone } from '../domain/types';

/**
 * Walking directions that go around the water, from OpenRouteService.
 *
 * The surveyed routes in `shelter_routes` stay authoritative and this never
 * overrides one. A ward officer who wrote "cross at the footbridge, not the rail
 * underpass — it floods to the roof" knows something no routing engine can derive
 * from a road graph, and 006_citizen_tables.sql carries exactly that caution.
 * This fills the gap instead: the roster has four shelters and the surveyed table
 * has routes for two, so the other two offer a compass bearing and a distance.
 * That is honest, and it is not directions.
 *
 * ------------------------------------------------------------------
 * Why a router at all, when the graph does not know about the flood
 * ------------------------------------------------------------------
 * It does once we tell it. ORS accepts `options.avoid_polygons`, so the live rows
 * from `risk_zones` — the same geometry the map draws and the same geometry
 * `isInsidePolygon` tests the user against — become hard exclusions in the routing
 * graph. That is the one thing an off-the-shelf engine cannot do for itself, and
 * the only reason this is worth a network call: not "the shortest way to the hall"
 * but "the shortest way that does not cross the critical zone".
 *
 * ------------------------------------------------------------------
 * What could not be verified from here
 * ------------------------------------------------------------------
 * No key and no network egress in the environment this was written in, so the
 * request below has never had a 200 back. Three consequences, all deliberate:
 *
 *   Every failure resolves to a reason instead of throwing, and the screen keeps
 *   the compass fallback it already had. Generated directions are an upgrade on a
 *   screen whose job is to keep working; they must never be able to replace a
 *   working bearing with a spinner.
 *
 *   With no key this does not reach the network at all, and `routingConfigured()`
 *   lets a screen skip the attempt entirely rather than render a failure it could
 *   have predicted. See `EXPO_PUBLIC_ORS_KEY` in .env.example.
 *
 *   Everything that can be checked without a network lives in domain/routing.ts,
 *   which scripts/check-domain.js asserts against — including the ring closing,
 *   which is the part that would silently un-avoid the flood if it were wrong.
 */

const ORS_KEY = process.env.EXPO_PUBLIC_ORS_KEY ?? '';

const ENDPOINT =
  'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';

/**
 * Shorter than the eight seconds supabase.ts allows, and the difference is the
 * point. Supabase carries the alerts, so waiting there beats not knowing. This
 * carries a nicer version of directions the screen can already give without it,
 * so a slow answer is worth less than a fast fallback.
 */
const TIMEOUT_MS = 6_000;

/** True when a key is present, so a screen can skip the attempt entirely. */
export function routingConfigured(): boolean {
  return ORS_KEY.length > 0;
}

export async function walkingRoute(
  from: RoutePoint,
  to: RoutePoint,
  avoid: RiskZone[],
): Promise<RoutingResult> {
  if (!routingConfigured()) return { ok: false, reason: 'unconfigured' };

  // AbortController rather than AbortSignal.timeout(), matching supabase.ts:
  // Hermes does not ship the static.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: ORS_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json',
      },
      body: JSON.stringify(directionsBody(from, to, avoid)),
      signal: controller.signal,
    });

    // ORS puts its reason in the body of a 4xx, and one of those reasons is "there
    // is no route", which the screen says out loud. So the body is read either way.
    const body = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, reason: orsFailure(body) };
    return parseOrsRoute(body);
  } catch {
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}
