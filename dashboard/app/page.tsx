"use client";

import dynamic from "next/dynamic";

// Force client-only rendering — this page uses browser APIs (MapLibre GL)
// and requires runtime env vars (Supabase URL/key)
const Dashboard = dynamic(() => import("@/components/Dashboard"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <h1 className="text-lg font-bold tracking-tight mb-2">
          <span className="text-teal-400">BHOOMI</span>
          <span className="text-zinc-500">—</span>
          <span className="text-orange-400">NETRA</span>
        </h1>
        <p className="text-xs text-zinc-600 animate-pulse">
          Loading dashboard...
        </p>
      </div>
    </div>
  ),
});

export default function Page() {
  return <Dashboard />;
}
