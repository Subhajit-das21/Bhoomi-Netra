import { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { LifeBuoy, MapPin, Siren, CheckCircle2, Clock, AlertTriangle, Navigation, ShieldPlus } from 'lucide-react';

const sosIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const teamIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });
const shelterIcon = new L.Icon({ iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] });

const sosRequests = [
  { id: 'SOS-4821', location: 'Rajarhat', hazard: 'Flood', status: 'Awaiting Response', lat: 22.632, lng: 88.435, time: '10:42 AM' },
  { id: 'SOS-4822', location: 'Salt Lake', hazard: 'Medical', status: 'Responding', lat: 22.580, lng: 88.415, time: '10:15 AM' },
  { id: 'SOS-4823', location: 'New Town', hazard: 'Flood', status: 'Completed', lat: 22.590, lng: 88.460, time: '09:30 AM' },
];

export default function SOS() {
  const [activeRequest, setActiveRequest] = useState(sosRequests[0]);
  const rescueRoute = [[22.575, 88.410], [22.578, 88.412], [22.580, 88.415]];

  const getStatusColor = (status) => {
    switch(status) {
      case 'Awaiting Response': return 'bg-rose-500/20 text-rose-400 border-rose-500/50';
      case 'Responding': return 'bg-amber-500/20 text-amber-400 border-amber-500/50';
      case 'Completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'Awaiting Response': return <AlertTriangle size={14} />;
      case 'Responding': return <Siren size={14} />;
      case 'Completed': return <CheckCircle2 size={14} />;
      default: return <Clock size={14} />;
    }
  };

  return (
    <div className="h-full bg-[#0B1120] text-slate-200 p-6 flex flex-col font-sans overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Active SOS Requests</h1>
          <p className="text-sm text-slate-400">Live civilian distress signals from Bhoomi-Netra Mobile App</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-lg flex items-center gap-3 shadow-lg">
          <LifeBuoy size={24} className="text-rose-500 animate-[spin_3s_linear_infinite]" />
          <div>
            <div className="text-xs text-rose-400 font-bold uppercase tracking-wide">Pending Rescues</div>
            <div className="text-lg font-bold text-white leading-tight">1 Active</div>
          </div>
        </div>
      </div>

      {/* FIXED: Removed flex-1 min-h-0 and added pb-10 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-10">
        
        {/* FIXED: Added min-h-[400px] */}
        <div className="xl:col-span-1 bg-[#111827] border border-slate-700/50 rounded-xl shadow-lg flex flex-col overflow-hidden min-h-[400px]">
          <div className="p-4 bg-[#151D2C] border-b border-slate-700/50 flex justify-between items-center">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Incident Queue</h2>
            <span className="text-xs text-blue-400 cursor-pointer">View All</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sosRequests.map((req) => (
              <div key={req.id} onClick={() => setActiveRequest(req)} className={`bg-[#1A2332] border rounded-lg p-4 cursor-pointer transition-all duration-200 ${activeRequest.id === req.id ? 'border-blue-500 shadow-md shadow-blue-900/20 bg-[#1E293B]' : 'border-slate-700/50 hover:border-slate-500'}`}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <LifeBuoy size={16} className={req.status === 'Awaiting Response' ? 'text-rose-400' : 'text-slate-400'}/> {req.id}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 border ${getStatusColor(req.status)}`}>
                    {getStatusIcon(req.status)} {req.status}
                  </span>
                </div>
                <div className="space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2"><MapPin size={14} className="text-slate-500"/> Location: <strong className="text-slate-200">{req.location}</strong></div>
                  <div className="flex items-center gap-2"><AlertTriangle size={14} className="text-slate-500"/> Hazard: <strong className="text-slate-200">{req.hazard}</strong></div>
                  <div className="flex items-center gap-2"><Clock size={14} className="text-slate-500"/> Logged: <strong className="text-slate-200">{req.time}</strong></div>
                </div>
                {req.status === 'Awaiting Response' && (
                  <button className="mt-4 w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2">
                    <Navigation size={14} /> Dispatch Nearest Team
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-2 bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden relative shadow-lg flex flex-col min-h-[500px]">
          <div className="p-4 bg-[#151D2C] border-b border-slate-700/50 flex justify-between items-center z-10">
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <MapPin size={16} className="text-blue-400" /> Tactical Dispatch Map
            </h2>
          </div>
          
          <div className="flex-1 relative z-0">
            <MapContainer center={[activeRequest.lat, activeRequest.lng]} zoom={13} style={{ height: '100%', width: '100%', backgroundColor: '#0B1120' }} key={`${activeRequest.lat}-${activeRequest.lng}`}>
              <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" className="map-tiles" />
              {sosRequests.map(req => <Marker key={req.id} position={[req.lat, req.lng]} icon={sosIcon} />)}
              <Circle center={[22.632, 88.435]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 1, dashArray: '5, 5' }} radius={800} />
              <Marker position={[22.575, 88.410]} icon={teamIcon} />
              <Marker position={[22.642, 88.448]} icon={shelterIcon} />
              {activeRequest.status === 'Responding' && <Polyline positions={rescueRoute} pathOptions={{ color: '#3b82f6', weight: 3, dashArray: '8, 8' }} />}
            </MapContainer>

            <div className="absolute bottom-4 left-4 z-[400] bg-[#111827]/95 backdrop-blur border border-slate-700/50 p-4 rounded-lg shadow-xl">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Map Legend</h3>
              <ul className="space-y-2 text-xs font-medium text-slate-300">
                <li className="flex items-center gap-2"><MapPin size={14} className="text-rose-500"/> Person Location</li>
                <li className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500/30 border border-rose-500 border-dashed rounded-full"></div> Hazard Zone</li>
                <li className="flex items-center gap-2"><ShieldPlus size={14} className="text-blue-500"/> Emergency Teams</li>
                <li className="flex items-center gap-2"><MapPin size={14} className="text-emerald-500"/> Nearest Shelter</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}