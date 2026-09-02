import { distanceMetres } from '../domain/geo';
import type {
  AlertWithContext,
  Hazard,
  Reading,
  RiskZone,
  RouteStep,
  SensorNode,
  Severity,
  Shelter,
} from '../domain/types';
import { selectRows } from '../services/supabase';

/**
 * Every read the citizen app makes, and the row → domain mapping for each.
 *
 * Two jobs, kept in one file because they are the same job. The PostgREST query
 * strings and the shapes they come back as have to agree, and putting them
 * side by side is what makes a mismatch obvious instead of a runtime `undefined`
 * three screens away.
 *
 * The `*Row` interfaces below describe what the database actually sends. They are
 * not the domain types: PostgREST hands back embedded objects, GeoJSON blobs and
 * operator-facing message text, and turning those into something a frightened
 * person can read is this layer's whole purpose.
 */

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface SensorNodeRow {
  id: string;
  name: string;
  node_type: SensorNode['node_type'];
  latitude: number;
  longitude: number;
  status: string;
}

interface AlertRow {
  id: string;
  node_id: string;
  hazard_type: Hazard;
  severity: Severity;
  message: string | null;
  resolved: boolean;
  created_at: string;
  /** Embedded through the alerts.node_id foreign key, aliased to `node`. */
  node: SensorNodeRow;
}

interface ReadingRow {
  id: string;
  node_id: string;
  temperature: number | null;
  humidity: number | null;
  flame_detected: boolean | null;
  smoke_level: number | null;
  water_level: number | null;
  rain_level: number | null;
  created_at: string;
}

interface ShelterRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  occupancy: number;
  status: Shelter['status'];
  elevation_metres: number;
  facilities: string[] | null;
}

/** From the risk_zones_geojson view, not the table — see 006_citizen_tables.sql. */
interface RiskZoneRow {
  id: string;
  name: string;
  hazard_type: Hazard;
  severity: Severity;
  geojson: { type: string; coordinates: number[][][] } | null;
}

interface ShelterRouteRow {
  shelter_id: string;
  step_order: number;
  manoeuvre: RouteStep['manoeuvre'];
  instruction: string;
  distance_metres: number;
  caution: string | null;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

/**
 * Unresolved alerts, newest first, with the node that raised each one.
 *
 * `resolved=eq.false` is filtered server-side rather than in the app. A citizen
 * has no use for the archive, and on a weak connection the rows we do not
 * download are the cheapest ones.
 *
 * The 40-row ceiling is a safety valve, not a page size. The feed groups by
 * proximity and nobody scrolls forty alerts in a flood; the limit is there so a
 * runaway sensor cannot turn the first load into a two-megabyte download on a
 * phone that has one bar.
 */
const ALERTS_QUERY =
  'select=id,node_id,hazard_type,severity,message,resolved,created_at,' +
  'node:sensor_nodes!inner(id,name,node_type,latitude,longitude,status)' +
  '&resolved=eq.false&order=created_at.desc&limit=40';

/**
 * Recent readings across all nodes, used as evidence behind each alert.
 *
 * 200 rows because the alert feed spans up to a day and six nodes report
 * continuously; this is enough history to find the reading behind the oldest
 * alert on screen without fetching the whole table.
 */
const READINGS_QUERY =
  'select=id,node_id,temperature,humidity,flame_detected,smoke_level,' +
  'water_level,rain_level,created_at&order=created_at.desc&limit=200';

export async function fetchAlerts(
  position: { latitude: number; longitude: number },
): Promise<AlertWithContext[]> {
  const [alertRows, readingRows] = await Promise.all([
    selectRows<AlertRow>('alerts', ALERTS_QUERY),
    selectRows<ReadingRow>('readings', READINGS_QUERY),
  ]);

  return alertRows.map((row) => ({
    id: row.id,
    node_id: row.node_id,
    hazard_type: row.hazard_type,
    severity: row.severity,
    message: citizenMessage(row.message),
    resolved: row.resolved,
    created_at: row.created_at,
    node: row.node,
    distanceMetres: distanceMetres(position, row.node),
    trigger: findTrigger(row, readingRows),
  }));
}

/**
 * The reading that tripped an alert, inferred rather than looked up.
 *
 * `alerts` has no reference to the reading that produced it — 004_alert_trigger
 * .sql inserts the alert from inside the row trigger and discards NEW.id — so the
 * best available answer is the newest reading from the same node at or before the
 * alert's timestamp. That is correct in practice because the trigger fires within
 * the same transaction as the insert, and it is honest when it is wrong: no match
 * returns null and the detail screen omits the evidence panel rather than showing
 * a neighbouring reading as if it were the cause.
 *
 * Worth a schema change eventually: an `alerts.reading_id` column would make this
 * a join instead of a guess. Raised as a note here rather than folded into
 * 006_citizen_tables.sql, which had no business editing the sensor tables.
 */
function findTrigger(alert: AlertRow, readings: ReadingRow[]): Reading | null {
  const alertAt = Date.parse(alert.created_at);
  // readings arrive newest-first, so the first match is already the closest one.
  return (
    readings.find(
      (r) =>
        r.node_id === alert.node_id &&
        Date.parse(r.created_at) <= alertAt + 1_000,
    ) ?? null
  );
}

/**
 * Strip the operator formatting out of a message before a citizen sees it.
 *
 * The trigger writes messages with emoji prefixes — `🌊 Critical water level:
 * 3100/4095`. Those are useful in a dashboard row and wrong here: this app
 * encodes severity as fill weight precisely so it survives greyscale, sunlight
 * and colour blindness, and an emoji sitting in the copy re-introduces the hue
 * cue the design removed. It is also the one glyph most likely to render as a
 * tofu box on a cheap Android handset, which is the exact device this app has to
 * work on.
 *
 * Only leading symbol characters go. The sentence itself is left intact, because
 * copy.ts already rewrites the parts a citizen should not have to read and this
 * function has no business second-guessing an authority's manual wording.
 */
function citizenMessage(message: string | null): string | null {
  if (message === null) return null;
  const cleaned = message.replace(/^[\p{Extended_Pictographic}\p{So}\s]+/u, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

// ---------------------------------------------------------------------------
// Shelters
// ---------------------------------------------------------------------------

/**
 * `location` is deliberately not selected. It is the geography column, and
 * PostgREST would send it as WKB hex — 50 bytes of `0101000020E6100000...` that
 * this app cannot read. `latitude` and `longitude` are the columns meant for
 * clients; `location` exists for the GiST index and for PostGIS queries.
 */
const SHELTERS_QUERY =
  'select=id,name,address,latitude,longitude,capacity,occupancy,status,' +
  'elevation_metres,facilities&order=name.asc';

export async function fetchShelters(): Promise<Shelter[]> {
  const rows = await selectRows<ShelterRow>('shelters', SHELTERS_QUERY);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    capacity: row.capacity,
    occupancy: row.occupancy,
    status: row.status,
    elevation_metres: row.elevation_metres,
    // The column is NOT NULL DEFAULT '{}', so this coalesce is for the case where
    // someone loosens that later. A missing facilities list must render as "no
    // information" and never crash a list row mid-evacuation.
    facilities: row.facilities ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Risk zones
// ---------------------------------------------------------------------------

/**
 * Ordered by name, not by severity. `severity` is a text column, so `order=
 * severity.asc` would sort it alphabetically — critical, high, low, medium — which
 * is not the ramp and would be a trap for the next person to read this. Draw order
 * on the map is the map's business; severity.ts owns the ranking.
 */
const ZONES_QUERY = 'select=id,name,hazard_type,severity,geojson&order=name.asc';

export async function fetchRiskZones(): Promise<RiskZone[]> {
  const rows = await selectRows<RiskZoneRow>('risk_zones_geojson', ZONES_QUERY);
  return rows
    .map((row) => {
      const polygon = outerRing(row.geojson);
      if (polygon === null) return null;
      return {
        id: row.id,
        name: row.name,
        hazard_type: row.hazard_type,
        severity: row.severity,
        polygon,
      };
    })
    .filter((zone): zone is RiskZone => zone !== null);
}

/**
 * The outer ring of a GeoJSON polygon as [lng, lat] pairs, with the closing
 * point dropped.
 *
 * PostGIS closes its rings — the first coordinate is repeated as the last, which
 * POLYGON requires — and the app's ring convention is open. The ray-casting test
 * and the SVG path both tolerate the duplicate, but the map's zone label sets
 * itself at the mean of the vertices, so a repeated corner would drag every
 * label towards it. Normalising here means one convention past this boundary
 * instead of three consumers each remembering to cope.
 *
 * Holes (rings beyond the first) are discarded. A hazard zone with a hole in it
 * is not a thing the citizen map draws, and quietly ignoring the inner rings is
 * better than rendering them as separate zones.
 */
function outerRing(
  geojson: RiskZoneRow['geojson'],
): [number, number][] | null {
  const ring = geojson?.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) return null;

  const open = ring.slice(0, -1).map(([lng, lat]) => [lng, lat] as [number, number]);
  return open.length >= 3 ? open : null;
}

// ---------------------------------------------------------------------------
// Walking routes
// ---------------------------------------------------------------------------

const ROUTES_QUERY =
  'select=shelter_id,step_order,manoeuvre,instruction,distance_metres,caution' +
  '&order=shelter_id.asc,step_order.asc';

/**
 * All surveyed routes, grouped by shelter.
 *
 * One request for every route rather than one per shelter, because the whole set
 * is a few kilobytes and the alternative is five round trips on a network that
 * may not survive five round trips.
 *
 * The result is deliberately a partial map: shelters with no surveyed route are
 * absent, and the provider returns an empty array for them rather than another
 * shelter's streets. See the note on shelter_routes in 006_citizen_tables.sql —
 * that gap is real data about what a district has and has not walked.
 */
export async function fetchRoutes(): Promise<Record<string, RouteStep[]>> {
  const rows = await selectRows<ShelterRouteRow>('shelter_routes', ROUTES_QUERY);
  const grouped: Record<string, RouteStep[]> = {};

  for (const row of rows) {
    const step: RouteStep = {
      manoeuvre: row.manoeuvre,
      instruction: row.instruction,
      distance_metres: row.distance_metres,
    };
    // Left off the object entirely when absent, so `caution` stays optional
    // rather than becoming `undefined`-valued — the screens test for presence.
    if (row.caution !== null) step.caution = row.caution;

    (grouped[row.shelter_id] ??= []).push(step);
  }

  return grouped;
}
