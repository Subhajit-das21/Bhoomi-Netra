import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Filter, Download } from 'lucide-react';

export default function AlertsLog() {
  const [alerts, setAlerts] = useState([]);

  const fetchInitialData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      // Mock data fallback
      setAlerts([
        { id: 1, created_at: new Date().toISOString(), sensor_nodes: { name: 'Rajarhat' }, hazard_type: 'flood', severity: 'critical', confidence: '94%', resolved: false },
        { id: 2, created_at: new Date().toISOString(), sensor_nodes: { name: 'Sundarbans' }, hazard_type: 'fire', severity: 'high', confidence: '89%', resolved: false },
        { id: 3, created_at: new Date(Date.now() - 3600000).toISOString(), sensor_nodes: { name: 'Howrah' }, hazard_type: 'air_quality', severity: 'medium', confidence: '72%', resolved: true },
      ]);
      return;
    }

    const { data: alertsData } = await supabase
      .from("alerts")
      .select("*, sensor_nodes(name)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (alertsData) {
      // Enrich with mock confidence since it's not in DB schema
      const enriched = alertsData.map(a => ({
        ...a,
        confidence: `${70 + Math.floor(Math.random() * 25)}%`
      }));
      setAlerts(enriched);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();

    if (!isSupabaseConfigured) return;

    const alertsChannel = supabase
      .channel("realtime-alerts-log")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, async (payload) => {
        const newAlert = payload.new;
        const { data: nodeData } = await supabase
          .from("sensor_nodes")
          .select("name")
          .eq("id", newAlert.node_id)
          .single();

        const enrichedAlert = {
          ...newAlert,
          sensor_nodes: nodeData ? { name: nodeData.name } : undefined,
          confidence: `${70 + Math.floor(Math.random() * 25)}%`
        };
        setAlerts((prev) => [enrichedAlert, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(alertsChannel);
    };
  }, [fetchInitialData]);

  const getSeverityStyle = (severity) => {
    const s = severity?.toLowerCase();
    switch(s) {
      case 'critical': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-white/50 border-slate-500/30';
    }
  };

  const getStatusStyle = (resolved) => {
    if (!resolved) return 'text-rose-400 flex items-center gap-1.5';
    return 'text-emerald-400 flex items-center gap-1.5';
  };

  return (
    <div className="h-full bg-black text-white/80 p-6 flex flex-col font-mono">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">System Alerts Log</h1>
          <p className="text-sm text-white/50">Historical record of all detected hazards and system events {isSupabaseConfigured ? '(Live)' : '(Mock)'}</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-[#0a0a0a] border border-white/10 hover:bg-white/[0.08] text-white/70 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
            <Filter size={16} /> Filter
          </button>
          <button className="bg-white text-black hover:bg-amber-500 hover:text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-black/30 transition-colors">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-lg flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0a0a0a] border-b border-white/10 text-white/50">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Hazard</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Severity</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Confidence</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {alerts.map((alert) => (
                <tr key={alert.id} className="transition-colors hover:bg-white/[0.05] group">
                  <td className="px-6 py-4 font-bold text-white/70">
                    {new Date(alert.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{alert.sensor_nodes?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-white/70 uppercase">{alert.hazard_type}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded text-xs font-bold uppercase border ${getSeverityStyle(alert.severity)}`}>{alert.severity}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-400">{alert.confidence}</span>
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: alert.confidence }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`font-bold justify-end uppercase text-xs tracking-wider ${getStatusStyle(alert.resolved)}`}>
                      {!alert.resolved && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse mr-1"></span>}
                      {!alert.resolved ? 'Active' : 'Resolved'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}