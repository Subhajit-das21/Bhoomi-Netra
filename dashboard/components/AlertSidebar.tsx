"use client";

import { Alert } from "@/lib/supabase";

interface AlertSidebarProps {
  alerts: Alert[];
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-teal-500",
};

const HAZARD_ICONS: Record<string, string> = {
  fire: "🔥",
  flood: "🌊",
};

function timeAgo(timestamp: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(timestamp).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AlertSidebar({ alerts }: AlertSidebarProps) {
  // Sort most recent first
  const sorted = [...alerts]
    .filter((a) => !a.resolved)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return (
    <aside className="w-80 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <span className="text-lg">🚨</span>
        <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">
          Active Alerts
        </h2>
        <span className="ml-auto text-xs font-mono text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded-full">
          {sorted.length}
        </span>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="p-6 text-center text-zinc-600 text-sm">
            No active alerts — all clear ✨
          </div>
        ) : (
          <ul className="divide-y divide-zinc-800/50">
            {sorted.map((alert) => (
              <li
                key={alert.id}
                className="px-4 py-3 hover:bg-zinc-900 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Severity dot */}
                  <span
                    className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                      SEVERITY_COLORS[alert.severity] ?? "bg-zinc-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    {/* Top row: hazard type + node name */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">
                        {HAZARD_ICONS[alert.hazard_type] ?? "⚠️"}
                      </span>
                      <span className="text-sm font-medium text-zinc-100 uppercase">
                        {alert.hazard_type}
                      </span>
                      <span className="text-xs text-zinc-500">·</span>
                      <span className="text-xs text-zinc-400 truncate">
                        {alert.sensor_nodes?.name ?? "Unknown Node"}
                      </span>
                    </div>

                    {/* Message */}
                    {alert.message && (
                      <p className="mt-1 text-xs text-zinc-400 leading-relaxed line-clamp-2">
                        {alert.message}
                      </p>
                    )}

                    {/* Bottom row: severity + timestamp */}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                          SEVERITY_COLORS[alert.severity] ?? "bg-zinc-600"
                        } text-white`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {timeAgo(alert.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
