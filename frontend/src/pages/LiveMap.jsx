import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { Layers, X, Droplets, AlertOctagon, Users, ShieldPlus, CloudRain } from 'lucide-react';

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const mockIncidents = [
  { id: 'BN-01', lat: 22.632, lng: 88.435, type: 'FLOOD', status: 'CRITICAL', location: 'Rajarhat', confidence: '94%', waterLevel: '82 cm', rainfall: '47mm/hr', riskPop: '8,200', aiScore: '94%' },
  { id: 'BN-02', lat: 22.645, lng: 88.420, type: 'FIRE', status: 'WARNING', location: 'Sundarbans Edge', confidence: '89%', wind: '18 km/h', temp: '38°C', riskPop: '1,200', aiScore: '89%' },
];

export default function LiveMap() {
  const [activeFilter, setActiveFilter] = useState('ALL HAZARDS');
  const [layers, setLayers] = useState({ nodes: true, flood: true, fire: true, shelters: true, population: false });
  const [hazardRadius, setHazardRadius] = useState(400);
  const [selectedIncident, setSelectedIncident] = useState(null);

  useEffect(() => {
    const pulseTimer = setInterval(() => {
      setHazardRadius(prev => prev > 600 ? 400 : prev + 50);
    }, 1500);
    return () => clearInterval(pulseTimer);
  }, []);

  return (
    <div className="h-full bg-black flex flex-col relative font-mono text-white/80">
      <div className="p-4 bg-[#0a0a0a] border-b border-white/10 flex justify-between items-center z-10 shadow-lg relative">
        <h2 className="text-xl font-bold text-white tracking-wide">Live Intelligence Map</h2>
        <div className="flex bg-black rounded-lg p-1 border border-white/10">
          {['ALL HAZARDS', 'FLOOD', 'FOREST FIRE', 'CRITICAL ONLY'].map(filter => (
            <button 
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${activeFilter === filter ? 'bg-white text-black text-white shadow-md' : 'text-white/50 hover:text-white'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 relative z-0">
        <div className="absolute top-4 left-4 z-[400] bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-2xl w-48">
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers size={14} /> Map Layers
          </h3>
          <div className="space-y-3">
            {[
              { id: 'nodes', label: 'Sensor Nodes' },
              { id: 'flood', label: 'Flood Zones' },
              { id: 'fire', label: 'Fire Zones' },
              { id: 'shelters', label: 'Safe Shelters' },
              { id: 'population', label: 'Population' }
            ].map(layer => (
              <label key={layer.id} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${layers[layer.id] ? 'bg-amber-500 border-amber-500' : 'border-slate-500 group-hover:border-slate-300'}`}>
                  {layers[layer.id] && <div className="w-2 h-2 bg-white rounded-sm"></div>}
                </div>
                <span className="text-sm text-white/70 group-hover:text-white">{layer.label}</span>
              </label>
            ))}
          </div>
        </div>

        <MapContainer center={[22.63, 88.43]} zoom={13} style={{ height: '100%', width: '100%', backgroundColor: '#0B1120' }}>
          <TileLayer 
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
            className="map-tiles"
          />
          
          {layers.flood && (
            <Circle center={[22.632, 88.435]} pathOptions={{ color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.2, weight: 2 }} radius={hazardRadius} eventHandlers={{ click: () => setSelectedIncident(mockIncidents[0]) }} />
          )}

          {layers.fire && (
            <Circle center={[22.645, 88.420]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.2, weight: 2 }} radius={hazardRadius * 0.8} eventHandlers={{ click: () => setSelectedIncident(mockIncidents[1]) }} />
          )}

          {layers.nodes && mockIncidents.map((node) => (
            <Marker key={node.id} position={[node.lat, node.lng]} icon={defaultIcon} eventHandlers={{ click: () => setSelectedIncident(node) }} />
          ))}
        </MapContainer>

        {selectedIncident && (
          <div className="absolute top-0 right-0 h-full w-96 bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[500] flex flex-col animate-[slideIn_0.3s_ease-out]">
            <div className={`p-5 flex justify-between items-start border-b border-white/10 ${selectedIncident.status === 'CRITICAL' ? 'bg-rose-900/20' : 'bg-orange-900/20'}`}>
              <div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block ${selectedIncident.status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  {selectedIncident.status} {selectedIncident.type} RISK
                </span>
                <h2 className="text-xl font-bold text-white">{selectedIncident.location}</h2>
                <p className="text-xs text-white/50 mt-1 flex items-center gap-1"><AlertOctagon size={12}/> AI Confidence: {selectedIncident.aiScore}</p>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-white/50 hover:text-white bg-white/10 p-1.5 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Current Situation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black p-3 rounded-lg border border-white/10">
                    <div className="text-white/30 text-xs mb-1 flex items-center gap-1"><Droplets size={12}/> Water Level</div>
                    <div className="text-lg font-bold text-white">{selectedIncident.waterLevel || 'N/A'}</div>
                  </div>
                  <div className="bg-black p-3 rounded-lg border border-white/10">
                    <div className="text-white/30 text-xs mb-1 flex items-center gap-1"><CloudRain size={12}/> Rainfall</div>
                    <div className="text-lg font-bold text-white">{selectedIncident.rainfall || 'N/A'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <Users size={14} /> Population Risk
                </h3>
                <p className="text-xl font-bold text-white mb-1">{selectedIncident.riskPop} people at risk</p>
                <p className="text-xs text-white/70">2 schools, 1 hospital in immediate trajectory.</p>
              </div>

              <div className="pt-2 space-y-3">
                <button className="w-full bg-white text-black hover:bg-amber-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-black/30 transition-colors">
                  View Spread Simulation
                </button>
                <button className="w-full bg-[#1e293b] hover:bg-white/[0.08] border border-white/15 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <ShieldPlus size={18}/> Send Community Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </div>
  );
}