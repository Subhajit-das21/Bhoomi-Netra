import { MapContainer, TileLayer, Circle, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { Users, Shield, Navigation, AlertTriangle, ArrowRight, HeartPulse } from 'lucide-react';

const shelterIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

export default function PopulationRisk() {
  const evacuationRoute = [
    [22.632, 88.435],
    [22.635, 88.438],
    [22.640, 88.442],
    [22.642, 88.448],
  ];

  return (
    <div className="h-full bg-black text-white/80 p-6 flex flex-col font-mono overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Population & Evacuation Logistics</h1>
          <p className="text-sm text-white/50">Real-time risk assessment and shelter routing</p>
        </div>
        <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-lg flex items-center gap-3 shadow-lg">
          <HeartPulse size={20} className="text-rose-500 animate-pulse" />
          <div>
            <div className="text-xs text-rose-400 font-bold uppercase tracking-wide">Total At Risk</div>
            <div className="text-lg font-bold text-white leading-tight">20,700</div>
          </div>
        </div>
      </div>

      {/* FIXED: Removed flex-1 min-h-0 and added pb-10 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 pb-10">
        <div className="xl:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-xl overflow-hidden relative shadow-lg flex flex-col min-h-[500px]">
          <div className="p-4 bg-[#0a0a0a] border-b border-white/10 flex justify-between items-center z-10">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
              <Navigation size={16} className="text-amber-400" /> Active Evacuation Routes
            </h2>
          </div>
          
          <div className="flex-1 relative z-0">
            <MapContainer center={[22.636, 88.440]} zoom={14} style={{ height: '100%', width: '100%', backgroundColor: '#0B1120' }}>
              <TileLayer 
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
                className="map-tiles"
              />
              <Circle center={[22.632, 88.435]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.25, weight: 2 }} radius={800} />
              <Circle center={[22.632, 88.435]} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.1, weight: 1, dashArray: '5, 5' }} radius={1500} />
              <Marker position={[22.642, 88.448]} icon={shelterIcon}>
                <Popup><strong className="text-black">Rajarhat Community Hall</strong><br/>Capacity: 320 / 500</Popup>
              </Marker>
              <Polyline positions={evacuationRoute} pathOptions={{ color: '#10b981', weight: 4, dashArray: '10, 10' }} />
            </MapContainer>

            <div className="absolute bottom-4 left-4 z-[400] bg-[#0a0a0a]/95 backdrop-blur border border-white/10 p-4 rounded-lg shadow-xl">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Map Legend</h3>
              <ul className="space-y-2 text-xs font-medium text-white/70">
                <li className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500/50 border border-rose-500 rounded-full"></div> High Risk Zone</li>
                <li className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500/30 border border-amber-500 border-dashed rounded-full"></div> Moderate Risk Zone</li>
                <li className="flex items-center gap-2"><div className="w-4 h-1 bg-emerald-500 border border-emerald-500 border-dashed"></div> Safe Route</li>
                <li className="flex items-center gap-2"><Shield size={14} className="text-emerald-500"/> Safe Shelter</li>
              </ul>
            </div>
          </div>
        </div>

        {/* FIXED: Added min-h-[400px] */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 shadow-lg flex flex-col overflow-y-auto min-h-[400px]">
          <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Users size={18} className="text-amber-400"/> Demographics at Risk
          </h2>
          
          <div className="space-y-4 mb-8">
            <div className="bg-rose-900/20 border border-rose-500/30 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="text-rose-400 font-bold flex items-center gap-2"><AlertTriangle size={16}/> HIGH RISK</span>
                <span className="text-xl font-bold text-white">8,200</span>
              </div>
              <p className="text-xs text-white/50">Immediate mandatory evacuation required.</p>
            </div>
            <div className="bg-amber-900/20 border border-amber-500/30 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-1">
                <span className="text-amber-400 font-bold flex items-center gap-2"><AlertTriangle size={16}/> MODERATE RISK</span>
                <span className="text-xl font-bold text-white">12,500</span>
              </div>
              <p className="text-xs text-white/50">Voluntary evacuation advised. Standby for updates.</p>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 mb-6"></div>

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
              <Shield size={18} className="text-emerald-400"/> Active Shelters
            </h2>
            <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">1 / 4 OPEN</span>
          </div>

          <div className="bg-white/[0.05] border border-white/10 p-4 rounded-lg shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-bold text-white text-sm">Rajarhat Community Hall</h3>
              <span className="text-xs font-medium text-white/50 text-right">Distance<br/><span className="text-amber-400 font-bold">1.2 km</span></span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-xs font-medium text-white/50 mb-1">
                <span>Occupied: 320</span>
                <span>Capacity: 500</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5 mb-1">
                <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: '64%' }}></div>
              </div>
              <p className="text-[10px] text-white/30 text-right">64% Full</p>
            </div>
            <button className="mt-4 w-full bg-white/[0.08] hover:bg-[#334155] border border-white/15 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-2">
              View Route Details <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}