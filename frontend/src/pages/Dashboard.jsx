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
  const topCards = [
    { title: 'Total Nodes', value: '128', subtext: 'All Locations', icon: <Radio size={24} className="text-blue-400" /> },
    { title: 'Online', value: '112', subtext: '87.5%', icon: <CheckCircle2 size={24} className="text-emerald-400" /> },
    { title: 'Warning', value: '9', subtext: '7.0%', icon: <AlertTriangle size={24} className="text-amber-400" /> },
    { title: 'Critical', value: '7', subtext: '5.5%', icon: <AlertOctagon size={24} className="text-rose-500" /> },
    { title: 'Active Hazards', value: '3', subtext: 'View All', icon: <Activity size={24} className="text-purple-400" /> },
    { title: 'Last Updated', value: new Date().toLocaleTimeString(), subtext: 'Today', icon: <Clock size={24} className="text-slate-400" /> },
  ];

  const activeIncidents = [
    { id: 1, type: 'CRITICAL FLOOD RISK', location: 'Rajarhat, Kolkata', time: '10:15 AM', confidence: '94%', icon: <Droplets size={20} className="text-blue-400" />, severity: 'Critical', color: 'border-rose-500' },
    { id: 2, type: 'FOREST FIRE DETECTED', location: 'Sundarbans, West Bengal', time: '09:47 AM', confidence: '89%', icon: <Flame size={20} className="text-orange-500" />, severity: 'High', color: 'border-orange-500' },
    { id: 3, type: 'AIR QUALITY ALERT', location: 'Howrah, West Bengal', time: '09:20 AM', confidence: '72%', icon: <Wind size={20} className="text-amber-400" />, severity: 'Medium', color: 'border-amber-400' },
  ];

  return (
    <div className="h-full bg-[#0B1120] text-slate-200 p-6 overflow-y-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Main Dashboard</h1>
          <p className="text-sm text-slate-400">Environmental Intelligence Network</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {topCards.map((card, index) => (
          <div key={index} className="bg-[#111827] border border-slate-700/50 p-4 rounded-xl flex flex-col shadow-lg">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-slate-400">{card.title}</span>
              {card.icon}
            </div>
            <div className="text-2xl font-bold text-white mb-1">{card.value}</div>
            <div className="text-xs font-semibold text-slate-500">{card.subtext}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <div className="xl:col-span-2 bg-[#111827] border border-slate-700/50 rounded-xl flex flex-col shadow-lg overflow-hidden min-h-[400px]">
          <div className="p-4 border-b border-slate-700/50 flex justify-between items-center bg-[#151D2C] z-10">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Live Map Overview</h2>
            <div className="flex gap-3 text-xs font-medium text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Normal</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Warning</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500"></span> Critical</span>
            </div>
          </div>
          
          <div className="flex-1 relative z-0 bg-[#0B1120]">
            <MapContainer center={[22.63, 88.43]} zoom={12} style={{ height: '100%', width: '100%', backgroundColor: '#0B1120' }}>
              <TileLayer 
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                className="map-tiles"
              />
              <Circle center={[22.632, 88.435]} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }} radius={800} />
              <Circle center={[22.645, 88.420]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2 }} radius={500} />
              <Marker position={[22.632, 88.435]} icon={defaultIcon} />
              <Marker position={[22.645, 88.420]} icon={defaultIcon} />
            </MapContainer>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-700/50 rounded-xl p-5 shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Active Incidents</h2>
            <span className="text-xs text-blue-400 cursor-pointer hover:underline">View All</span>
          </div>
          
          <div className="flex flex-col gap-4 overflow-y-auto">
            {activeIncidents.map((incident) => (
              <div key={incident.id} className={`bg-[#1A2332] p-4 rounded-lg border-l-4 ${incident.color} border-y border-r border-slate-700/50 shadow-sm relative group cursor-pointer hover:bg-[#1E293B] transition-colors`}>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {incident.icon} {incident.type}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    incident.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                    incident.severity === 'High' ? 'bg-orange-500/20 text-orange-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {incident.severity}
                  </span>
                </div>
                <div className="text-xs text-slate-400 space-y-1">
                  <p className="flex justify-between"><span>Location:</span> <span className="text-slate-200">{incident.location}</span></p>
                  <p className="flex justify-between"><span>Detected:</span> <span className="text-slate-200">{incident.time}</span></p>
                  <p className="flex justify-between"><span>AI Confidence:</span> <span className="font-bold text-blue-400">{incident.confidence}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-[#111827] border border-slate-700/50 p-5 rounded-xl shadow-lg">
          <h2 className="text-sm font-bold text-slate-200 uppercase mb-4 tracking-wider">Weather Overview</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl">🌧️</div>
            <div>
              <div className="text-3xl font-bold text-white">28°C</div>
              <div className="text-sm text-slate-400">Light Rain</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs border-t border-slate-700 pt-3">
            <div><div className="text-slate-500 mb-1">Humidity</div><div className="text-white font-medium">84%</div></div>
            <div><div className="text-slate-500 mb-1">Wind</div><div className="text-white font-medium">18 km/h</div></div>
            <div><div className="text-slate-500 mb-1">Rainfall</div><div className="text-white font-medium">32 mm</div></div>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-700/50 p-5 rounded-xl shadow-lg flex items-center justify-center relative">
           <div className="text-center">
             <div className="text-3xl font-bold text-emerald-400">87.5%</div>
             <div className="text-sm text-slate-400 mt-1">Network Uptime</div>
           </div>
        </div>

        <div className="bg-[#111827] border border-slate-700/50 p-5 rounded-xl shadow-lg bg-gradient-to-br from-[#111827] to-[#2B151E]">
          <h2 className="text-sm font-bold text-rose-400 uppercase mb-4 tracking-wider flex items-center gap-2">
            <Users size={16} /> Population at Risk
          </h2>
          <div className="text-4xl font-bold text-white mb-1">12,450</div>
          <div className="text-sm text-slate-300">People currently in affected zones</div>
          <div className="mt-4 text-xs font-semibold bg-rose-500/20 text-rose-300 py-1.5 px-3 rounded-full inline-block">
            Across 4 Districts
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-700/50 p-5 rounded-xl shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Recent Alerts</h2>
            <span className="text-xs text-blue-400 cursor-pointer">View All</span>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center gap-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span className="text-slate-400 w-16">10:15 AM</span>
              <span className="text-slate-200 font-medium">Flood Risk - Rajarhat</span>
            </li>
            <li className="flex items-center gap-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              <span className="text-slate-400 w-16">09:47 AM</span>
              <span className="text-slate-200 font-medium">Fire - Sundarbans</span>
            </li>
            <li className="flex items-center gap-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span className="text-slate-400 w-16">09:20 AM</span>
              <span className="text-slate-200 font-medium">AQI - Howrah</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}