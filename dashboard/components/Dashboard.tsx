"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase, isSupabaseConfigured, SensorNode, Reading, Alert } from "@/lib/supabase";
import MapView from "@/components/MapView";
import AlertSidebar from "@/components/AlertSidebar";
import SimulationLayer from "@/components/SimulationLayer";

export default function Dashboard() {
  const [nodes, setNodes] = useState<SensorNode[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [latestReadings, setLatestReadings] = useState<
    Record<string, { temperature?: number | null; water_level?: number | null }>
  >({});
  const [connected, setConnected] = useState(false);

  // ── Fetch initial data ───────────────────────────────────
  const fetchInitialData = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    // Fetch sensor nodes
    const { data: nodesData } = await supabase
      .from("sensor_nodes")
      .select("*")
      .order("name");

    if (nodesData) setNodes(nodesData);

    // Fetch active alerts with node names
    const { data: alertsData } = await supabase
      .from("alerts")
      .select("*, sensor_nodes(name)")
      .eq("resolved", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (alertsData) setAlerts(alertsData);

    // Fetch latest reading per node (grab recent readings, dedupe client-side)
    const { data: readingsData } = await supabase
      .from("readings")
      .select("node_id, temperature, water_level, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (readingsData) {
      const latest: Record<
        string,
        { temperature?: number | null; water_level?: number | null }
      > = {};
      readingsData.forEach((r: Pick<Reading, "node_id" | "temperature" | "water_level" | "created_at">) => {
        if (!latest[r.node_id]) {
          latest[r.node_id] = {
            temperature: r.temperature,
            water_level: r.water_level,
          };
        }
      });
      setLatestReadings(latest);
    }
  }, []);

  // ── Subscribe to Realtime ────────────────────────────────
  useEffect(() => {
    fetchInitialData();

    if (!isSupabaseConfigured) return;

    // Realtime channel for new readings
    const readingsChannel = supabase
      .channel("realtime-readings")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings" },
        (payload) => {
          const newReading = payload.new as Reading;
          setLatestReadings((prev) => ({
            ...prev,
            [newReading.node_id]: {
              temperature: newReading.temperature,
              water_level: newReading.water_level,
            },
          }));
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
      });

    // Realtime channel for new alerts
    const alertsChannel = supabase
      .channel("realtime-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        async (payload) => {
          const newAlert = payload.new as Alert;
          // Fetch the node name for this alert
          const { data: nodeData } = await supabase
            .from("sensor_nodes")
            .select("name")
            .eq("id", newAlert.node_id)
            .single();

          const enrichedAlert: Alert = {
            ...newAlert,
            sensor_nodes: nodeData ? { name: nodeData.name } : undefined,
          };
          setAlerts((prev) => [enrichedAlert, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(readingsChannel);
      supabase.removeChannel(alertsChannel);
    };
  }, [fetchInitialData]);

  // ── Not configured state ─────────────────────────────────
  if (!isSupabaseConfigured) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="max-w-md text-center p-8 rounded-xl border border-zinc-800 bg-zinc-900">
          <h1 className="text-lg font-bold tracking-tight mb-3">
            <span className="text-teal-400">BHOOMI</span>
            <span className="text-zinc-500">—</span>
            <span className="text-orange-400">NETRA</span>
          </h1>
          <p className="text-sm text-zinc-400 mb-4">
            Supabase credentials not configured.
          </p>
          <code className="text-xs text-teal-400 bg-zinc-950 px-3 py-2 rounded block">
            cp .env.local.example .env.local
          </code>
          <p className="text-xs text-zinc-600 mt-3">
            Then fill in your Supabase URL and anon key, and restart the dev
            server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      {/* ── Map area ──────────────────────────────────────── */}
      <main className="flex-1 relative">
        <MapView nodes={nodes} latestReadings={latestReadings} />

        {/* TODO: SimulationLayer overlay goes here */}
        <SimulationLayer />

        {/* Status indicator */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-zinc-900/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-zinc-800">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? "bg-teal-400 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <span className="text-[11px] font-mono text-zinc-400">
            {connected ? "LIVE" : "CONNECTING..."}
          </span>
        </div>

        {/* Branding */}
        <div className="absolute bottom-4 left-4 z-10">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-teal-400">BHOOMI</span>
            <span className="text-zinc-500">—</span>
            <span className="text-orange-400">NETRA</span>
          </h1>
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">
            Disaster Monitoring · SIH 2026
          </p>
        </div>
      </main>

      {/* ── Alert sidebar ─────────────────────────────────── */}
      <AlertSidebar alerts={alerts} />
    </div>
  );
}
