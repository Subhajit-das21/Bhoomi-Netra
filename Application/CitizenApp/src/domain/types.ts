/**
 * Domain types, mirrored from the Supabase schema in supabase/migrations/.
 *
 * These names and unions are deliberately identical to the database so that
 * swapping mock data for a live Supabase client is a transport change and not a
 * remodelling exercise. If the schema changes, this file changes with it.
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
}

// ---------------------------------------------------------------------------
// Shelters and routing
//
// Not in the Supabase schema yet. Modelled here so the citizen UI can be built
// and reviewed now; the shape is what we will propose for the shelters table.
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
  elevationMetres: number;
  facilities: string[];
}

export interface ShelterWithRoute extends Shelter {
  distanceMetres: number;
  walkMinutes: number;
  /** True when the walking route crosses a zone currently under alert. */
  routeCrossesRisk: boolean;
}

export type Manoeuvre = 'start' | 'left' | 'right' | 'straight' | 'arrive';

export interface RouteStep {
  manoeuvre: Manoeuvre;
  /** One instruction, imperative, naming a real street. */
  instruction: string;
  distanceMetres: number;
  /** Set when this leg is the risky part, so the UI can warn on the step itself. */
  caution?: string;
}

// ---------------------------------------------------------------------------
// Risk zones
// ---------------------------------------------------------------------------

export interface RiskZone {
  id: string;
  name: string;
  hazard: Hazard;
  severity: Severity;
  /** Ring of [longitude, latitude] pairs. Kept lng-first to match PostGIS. */
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
 */
export type DataFreshness = 'live' | 'cached' | 'stale' | 'offline';

export type SosState =
  | 'idle'
  | 'arming'
  | 'sending'
  | 'sent'
  | 'queued'
  | 'failed';
