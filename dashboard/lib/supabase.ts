import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// ── Singleton Supabase client ────────────────────────────────────────
// Returns a real client at runtime, or a placeholder during build/SSG.
// The dashboard is fully client-side so this only matters at runtime.
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// ── TypeScript types matching our schema ─────────────────────────────

export interface SensorNode {
  id: string;
  name: string;
  node_type: "forest" | "urban" | "universal";
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
}

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
  hazard_type: "flood" | "fire";
  severity: "low" | "medium" | "high" | "critical";
  message: string | null;
  resolved: boolean;
  created_at: string;
  // Joined from sensor_nodes when we query with a join
  sensor_nodes?: Pick<SensorNode, "name">;
}
