"use client";

/**
 * SimulationLayer — Placeholder for flood-fill and fire-spread overlays
 *
 * TODO: Implement flood-fill simulation overlay
 * - Accept water_level readings from nearby nodes
 * - Use DEM (Digital Elevation Model) data to compute flood spread
 * - Render as a semi-transparent blue polygon layer on the map
 * - Animate spread over time using requestAnimationFrame
 *
 * TODO: Implement fire-spread simulation overlay
 * - Accept temperature + flame_detected + wind data
 * - Use a cellular automaton or percolation model for fire spread
 * - Render as an animated orange/red gradient polygon layer
 * - Factor in vegetation density (node_type === 'forest' burns faster)
 *
 * TODO: Both overlays should:
 * - Toggle on/off via the dashboard UI
 * - Update in real-time as new readings arrive via Supabase Realtime
 * - Use maplibregl's addSource/addLayer for GeoJSON polygon rendering
 * - Have configurable time-step controls (play/pause/speed)
 */

export default function SimulationLayer() {
  // This component intentionally renders nothing right now.
  // It's a placeholder for the simulation workstream.
  return null;
}
