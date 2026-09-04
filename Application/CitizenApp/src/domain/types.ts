/**
 * Domain types, mirrored from the Supabase schema in supabase/migrations/.
 *
 * These names and unions are deliberately identical to the database so that
 * swapping mock data for a live Supabase client is a transport change and not a
 * remodelling exercise. If the schema changes, this file changes with it.
 *
 * The casing carries meaning and is worth keeping straight: a snake_case field
 * arrived in a row exactly as written, and a camelCase field was computed on the
 * device. `ShelterWithRoute` has both — `elevation_metres` came from the shelters
 * table, `distanceMetres` was measured from wherever the user is standing — and
 * the two behave differently under a stale cache, which is why they do not look
 * alike.
 */

/** alerts.severity — CHECK (severity IN ('low','medium','high','critical')) */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/** alerts.hazard_type — CHECK (hazard_type IN ('flood','fire')) */
export type Hazard = 'flood' | 'fire';

/** sensor_nodes.node_type — CHECK (node_type IN ('forest','urban','universal')) */
export type NodeType = 'forest' | 'urban' | 'universal';

export interface SensorNode {
  id: string;
  name: string;
  node_type: NodeType;
  latitude: number;
  longitude: number;
  status: string;
}

/**
 * readings — every field except node_id is nullable in the schema, because a
 * forest node and an urban node do not carry the same sensor set.
 * water_level, smoke_level and rain_level are raw 12-bit ADC counts (0-4095).
 */
export interface Reading {
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

export interface Alert {
  id: string;
  node_id: string;
  hazard_type: Hazard;
  severity: Severity;
  message: string | null;
  resolved: boolean;
  created_at: string;
}

/**
 * An alert joined to the node that raised it, plus the distance from the user.
 * The feed needs all three to rank and to say "1.2 km away" — the raw alert
 * row alone cannot answer "does this concern me?".
 */
export interface AlertWithContext extends Alert {
  node: SensorNode;
  /** Metres from the user's last known position to the reporting node. */
  distanceMetres: number;
  /** The reading that tripped the trigger, when known. Drives the evidence panel. */
  trigger: Reading | null;
  /**
   * This node's recent readings, newest first, for the trend line.
   *
   * A single `trigger` says the water was at 76% when the alert fired. It cannot
   * say whether it is still climbing, which is the only part that decides whether
   * to leave now — so the detail screen gets the series, not just the point. Empty
   * when the node has no history in the fetched window.
   */
  history: Reading[];
}

// ---------------------------------------------------------------------------
// Shelters and routing — supabase/migrations/006_citizen_tables.sql
// ---------------------------------------------------------------------------

export interface Shelter {
  id: string;
  name: string;
  /** Plain-language address a person can act on without a map. */
  address: string;
  latitude: number;
  longitude: number;
  capacity: number;
  occupancy: number;
  /** open = accepting people, full = at capacity, closed = do not go there. */
  status: 'open' | 'full' | 'closed';
  /** Ground floor above local datum, in metres. Matters in a flood. */
  elevation_metres: number;
  facilities: string[];
}

export interface ShelterWithRoute extends Shelter {
  distanceMetres: number;
  walkMinutes: number;
  /** True when the walking route crosses a zone currently under alert. */
  routeCrossesRisk: boolean;
}

/** shelter_routes.manoeuvre — CHECK (manoeuvre IN ('start','left','right','straight','arrive')) */
export type Manoeuvre = 'start' | 'left' | 'right' | 'straight' | 'arrive';

export interface RouteStep {
  manoeuvre: Manoeuvre;
  /** One instruction, imperative, naming a real street. */
  instruction: string;
  /**
   * Length of this leg. Snake_case because it is the surveyed column value, and
   * that matters on screens which show it beside `ShelterWithRoute.distanceMetres`
   * — one is how far this turn runs, the other is how far you still are from the
   * building. They used to share a name.
   */
  distance_metres: number;
  /** Set when this leg is the risky part, so the UI can warn on the step itself. */
  caution?: string;
}

// ---------------------------------------------------------------------------
// Risk zones — read through the risk_zones_geojson view, not the table
// ---------------------------------------------------------------------------

export interface RiskZone {
  id: string;
  name: string;
  hazard_type: Hazard;
  severity: Severity;
  /**
   * Outer ring as [longitude, latitude] pairs, lng-first to match PostGIS.
   * Open — the closing point PostGIS repeats is dropped in data/queries.ts.
   */
  polygon: [number, number][];
}

export interface UserPosition {
  latitude: number;
  longitude: number;
  /** GPS accuracy in metres. Shown to the user rather than hidden. */
  accuracyMetres: number;
  /** When this fix was taken. A stale fix is a safety problem, so it is surfaced. */
  takenAt: string;
  /** Human-readable ward or locality, for headers and SOS payloads. */
  locality: string;
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

/**
 * How much to trust what is on screen.
 *   live    — connected, data fetched seconds ago
 *   cached  — no connection, showing the last successful fetch
 *   stale   — cached and old enough that it may no longer be true
 *   offline — no connection and nothing useful cached
 *
 * `offline` is the state a cold start lands in when the first fetch fails, and it
 * is the one that must not be papered over. No on-device store is installed, so
 * the cache lives in memory for the session only: kill the app on a train with no
 * signal and there is genuinely nothing to show. Shipping the old fixtures as a
 * fallback would fill that screen, and would do it by naming a shelter that may
 * have closed hours ago — which is how an app gets someone killed being helpful.
 */
export type DataFreshness = 'live' | 'cached' | 'stale' | 'offline';

/**
 * Whether we have anything to show yet.
 *
 * Separate from `DataFreshness` because they answer different questions and the
 * screens need both: freshness is "how old is this", load is "is there anything
 * here at all". A first load and a failed refresh look nothing alike to a
 * reader, even though both mean the network is unhappy.
 */
export type LoadState = 'first-load' | 'ready' | 'failed';

/**
 * Why a load failed, in the only terms worth distinguishing on screen.
 *   unreachable — no signal, a slow network, or a timeout. Retrying may work.
 *   unconfigured — this build shipped without Supabase credentials.
 *   server — we reached the database and it refused. Retrying will not help.
 */
export type LoadFailure = 'unreachable' | 'unconfigured' | 'server';

export type SosState =
  | 'idle'
  | 'arming'
  | 'sending'
  | 'sent'
  | 'queued'
  | 'failed';

// ---------------------------------------------------------------------------
// The household — supabase/migrations/007_households.sql
// ---------------------------------------------------------------------------

/** households.language — CHECK (language IN ('en','bn','hi')) */
export type Language = 'en' | 'bn' | 'hi';

/** households.tenure — CHECK (tenure IN ('own','rent','other')) */
export type Tenure = 'own' | 'rent' | 'other';

/**
 * Who is in the house.
 *
 * Snake_case throughout, because every field is a column: this is the exact
 * argument list of `update_household` and the exact return shape of
 * `restore_household`, and keeping the names identical is what makes the two
 * calls in data/household.ts readable against the migration.
 *
 * Everything except `language` and `people` is nullable or zero, and that is a
 * design commitment rather than laxity. The flow is skippable step by step, and
 * a household that told us its ward but not its address is more use to a rescue
 * team than one that gave up on the form. Anything that reads this must cope with
 * a profile that answers two questions out of eleven.
 */
export interface HouseholdProfile {
  language: Language;
  contact_name: string | null;
  ward: string | null;
  address: string | null;
  /** At least one: a profile exists because somebody made it. */
  people: number;
  tenure: Tenure | null;

  /**
   * The assisted-evacuation counts. These deliberately do not sum to `people` —
   * an eighty-year-old who cannot swim belongs in two of them — and the schema
   * checks each against `people` individually rather than in total, so that
   * nobody is forced to under-report to satisfy a constraint.
   */
  elderly: number;
  infants: number;
  pregnant: number;
  needs_assistance: number;
  non_swimmers: number;

  /** Free text, null when there are none. A planning fact, not a curiosity. */
  livestock: string | null;
}

/**
 * A profile as held on the device: the answers, plus what we know about them.
 *
 * `saved_at` is the server's `updated_at` when the last write reached Supabase,
 * and the device clock otherwise. It is what the reinstall prompt is stamped
 * with, so an eight-month-old profile looks eight months old.
 *
 * `synced` false means the answers are on this phone and nowhere else. That is a
 * normal state, not an error: somebody filling this in during a flood has worse
 * problems than our connectivity, and the retry is ours to carry.
 */
export interface StoredHousehold {
  profile: HouseholdProfile;
  saved_at: string;
  synced: boolean;
  /** Set while the household has told the district it does not need rescue. */
  safe_at: string | null;
}
