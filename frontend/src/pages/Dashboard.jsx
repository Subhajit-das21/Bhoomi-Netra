import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  Radio, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Activity, 
  Clock, 
  Flame, 
  Wind, 
  Droplets, 
  Users 
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function Dashboard() {
  const [nodes, setNodes] = useState([]);
  const [alerts, setAlerts] = useState([]);
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
  }, []);

  // ── Subscribe to Realtime ────────────────────────────────
  useEffect(() => {
    fetchInitialData();

    if (!isSupabaseConfigured) return;

    // Realtime channel for new alerts
    const alertsChannel = supabase
      .channel("realtime-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        async (payload) => {
          const newAlert = payload.new;
          // Fetch the node name for this alert
          const { data: nodeData } = await supabase
            .from("sensor_nodes")
            .select("name")
            .eq("id", newAlert.node_id)
            .single();

          const enrichedAlert = {
            ...newAlert,
            sensor_nodes: nodeData ? { name: nodeData.name } : undefined,
          };
          setAlerts((prev) => [enrichedAlert, ...prev]);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setConnected(true);
      });

    return () => {
      supabase.removeChannel(alertsChannel);
    };
  }, [fetchInitialData]);

  // Derived stats
  const totalNodes = nodes.length || 128; // Fallback to mockup if no data
  const onlineNodes = nodes.filter(n => n.status === 'online').length || 112;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length || 7;
  const warningAlerts = alerts.filter(a => a.severity === 'high' || a.severity === 'medium').length || 9;
  const activeHazards = alerts.length || 3;
  const uptime = Math.round((onlineNodes / totalNodes) * 100) || 87.5;

  const topCards = [
    { title: 'Total Nodes', value: totalNodes.toString(), subtext: 'All Locations', icon: <Radio size={24} className="text-amber-400" /> },
    { title: 'Online', value: onlineNodes.toString(), subtext: `${uptime}%`, icon: <CheckCircle2 size={24} className="text-emerald-400" /> },
    { title: 'Warning', value: warningAlerts.toString(), subtext: 'Review needed', icon: <AlertTriangle size={24} className="text-amber-400" /> },
    { title: 'Critical', value: criticalAlerts.toString(), subtext: 'Immediate action', icon: <AlertOctagon size={24} className="text-rose-500" /> },
    { title: 'Active Hazards', value: activeHazards.toString(), subtext: 'View All', icon: <Activity size={24} className="text-purple-400" /> },
    { title: 'Status', value: connected ? 'LIVE' : 'OFFLINE', subtext: 'Supabase Realtime', icon: <Clock size={24} className={connected ? "text-emerald-400" : "text-white/50"} /> },
  ];

  // Helper to render alert icon
  const getAlertIcon = (type) => {
    if (type === 'fire') return <Flame size={20} className="text-orange-500" />;
    if (type === 'flood') return <Droplets size={20} className="text-amber-400" />;
    return <Wind size={20} className="text-amber-400" />;
  };

  const getAlertColor = (severity) => {
    if (severity === 'critical') return 'border-rose-500';
    if (severity === 'high') return 'border-orange-500';
    return 'border-amber-400';
  };

  // Map supabase alerts or fallback to mockups
  const displayAlerts = alerts.length > 0 ? alerts : [
    { id: 1, hazard_type: 'flood', sensor_nodes: { name: 'Rajarhat, Kolkata' }, created_at: new Date().toISOString(), severity: 'critical' },
    { id: 2, hazard_type: 'fire', sensor_nodes: { name: 'Sundarbans, West Bengal' }, created_at: new Date().toISOString(), severity: 'high' },
    { id: 3, hazard_type: 'air_quality', sensor_nodes: { name: 'Howrah, West Bengal' }, created_at: new Date().toISOString(), severity: 'medium' },
  ];

  return (
    <div className="h-full bg-black text-white/80 p-6 overflow-y-auto font-mono">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Main Dashboard</h1>
          <p className="text-sm text-white/50">Environmental Intelligence Network {isSupabaseConfigured ? '(Connected to Supabase)' : '(Mock Data)'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {topCards.map((card, index) => (
          <div key={index} className="bg-[#0a0a0a] border border-white/10 p-4 rounded-xl flex flex-col shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-white/50">{card.title}</span>
              {card.icon}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
            <div className="text-xs font-semibold text-white/30">{card.subtext}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-xl flex flex-col shadow-lg overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0a0a0a] z-10">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">Live Map Overview</h2>
            <div className="flex gap-3 text-xs font-medium text-white/50">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Warning</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Critical</span>
            </div>
          </div>
          
          <div className="flex-1 relative z-0 bg-black">
            <MapContainer center={[22.63, 88.43]} zoom={12} style={{ height: '100%', width: '100%', backgroundColor: '#000000' }}>
              <TileLayer 
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                className="map-tiles"
              />
              {/* If we have nodes from supabase, render them, otherwise use mockup coords */}
              {nodes.length > 0 ? nodes.map(node => (
                 <Marker key={node.id} position={[node.latitude, node.longitude]} icon={defaultIcon} />
              )) : (
                <>
                  <Circle center={[22.632, 88.435]} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2, weight: 2 }} radius={800} />
                  <Circle center={[22.645, 88.420]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2 }} radius={500} />
                  <Marker position={[22.632, 88.435]} icon={defaultIcon} />
                  <Marker position={[22.645, 88.420]} icon={defaultIcon} />
                </>
              )}
            </MapContainer>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">Active Incidents</h2>
            <span className="text-xs text-amber-400 cursor-pointer hover:underline">View All</span>
          </div>
          
          <div className="flex flex-col gap-4 overflow-y-auto">
            {displayAlerts.slice(0,5).map((incident, i) => (
              <div key={incident.id || i} className={`bg-white/[0.05] p-4 rounded-lg border-l-4 ${getAlertColor(incident.severity)} border-y border-r border-white/10 shadow-sm relative group cursor-pointer hover:bg-white/[0.08] transition-colors`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase">
                    {getAlertIcon(incident.hazard_type)} {incident.hazard_type}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    incident.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' :
                    incident.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {incident.severity}
                  </span>
                </div>
                <div className="text-xs text-white/50 space-y-1">
                  <p className="flex justify-between"><span>Location:</span> <span className="text-white/80">{incident.sensor_nodes?.name || 'Unknown'}</span></p>
                  <p className="flex justify-between"><span>Detected:</span> <span className="text-white/80">{new Date(incident.created_at).toLocaleTimeString()}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl shadow-lg">
          <h2 className="text-sm font-bold text-white/80 uppercase mb-4 tracking-wider">Weather Overview</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl">🌧️</div>
            <div>
              <div className="text-3xl font-bold text-white">28°C</div>
              <div className="text-sm text-white/50">Light Rain</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-white/10 pt-3">
            <div><div className="text-white/30 mb-1">Humidity</div><div className="text-white font-medium">84%</div></div>
            <div><div className="text-white/30 mb-1">Wind</div><div className="text-white font-medium">18 km/h</div></div>
            <div><div className="text-white/30 mb-1">Rainfall</div><div className="text-white font-medium">32 mm</div></div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl shadow-lg flex items-center justify-center relative">
           <div className="text-center">
             <div className="text-3xl font-bold text-emerald-400">{uptime}%</div>
             <div className="text-sm text-white/50 mt-1">Network Uptime</div>
           </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl shadow-lg bg-gradient-to-br from-[#111827] to-[#2B151E]">
          <h2 className="text-sm font-bold text-rose-400 uppercase mb-4 tracking-wider flex items-center gap-2">
            <Users size={16} /> Population at Risk
          </h2>
          <div className="text-4xl font-bold text-white mb-1">12,450</div>
          <div className="text-sm text-white/70">People currently in affected zones</div>
          <div className="mt-4 text-xs font-semibold bg-rose-500/20 text-rose-300 py-1.5 px-3 rounded-full inline-block">
            Across 4 Districts
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 p-5 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">Recent Alerts</h2>
            <span className="text-xs text-amber-400 cursor-pointer">View All</span>
          </div>
          <ul className="space-y-3">
            {displayAlerts.slice(0,3).map((a, i) => (
              <li key={i} className="flex items-center gap-3 text-xs">
                <span className={`w-2 h-2 rounded-full ${a.severity === 'critical' ? 'bg-rose-500' : a.severity === 'high' ? 'bg-orange-500' : 'bg-amber-500'}`}></span>
                <span className="text-white/50 w-16">{new Date(a.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                <span className="text-white/80 font-medium truncate">{a.hazard_type} - {a.sensor_nodes?.name || 'Unknown'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}