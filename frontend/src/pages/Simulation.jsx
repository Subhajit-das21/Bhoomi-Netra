import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import { Play, Pause, Settings2, CloudRain, Droplets, Wind, Navigation } from 'lucide-react';

export default function Simulation() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeStep, setTimeStep] = useState('NOW');
  const [controls, setControls] = useState({ population: true, shelters: true, roads: true });
  const timeOptions = ['NOW', '+15 MIN', '+30 MIN', '+60 MIN'];

  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setTimeStep(current => {
          const currentIndex = timeOptions.indexOf(current);
          if (currentIndex === timeOptions.length - 1) {
            setIsPlaying(false);
            return current;
          }
          return timeOptions[currentIndex + 1];
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const getRadius = () => {
    switch(timeStep) {
      case 'NOW': return 400;
      case '+15 MIN': return 800;
      case '+30 MIN': return 1500;
      case '+60 MIN': return 2500;
      default: return 400;
    }
  };

  return (
    <div className="h-full bg-[#0B1120] text-slate-200 p-6 flex flex-col font-sans overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Predictive Spread Simulation</h1>
          <p className="text-sm text-slate-400">Rajarhat, Kolkata - Flood Hazard</p>
        </div>
        
        <div className="flex bg-[#111827] rounded-lg p-1 border border-slate-700/50 shadow-lg">
          {timeOptions.map(time => (
            <button 
              key={time}
              onClick={() => { setTimeStep(time); setIsPlaying(false); }}
              className={`px-5 py-2 text-sm font-bold rounded-md transition-colors ${timeStep === time ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              {time}
            </button>
          ))}
          <div className="w-px bg-slate-700 mx-2"></div>
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 text-emerald-400 hover:text-emerald-300 flex items-center gap-2 font-bold"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            {isPlaying ? 'PAUSE' : 'PLAY'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pb-10">
        
        <div className="lg:col-span-3 bg-[#111827] border border-slate-700/50 rounded-xl overflow-hidden relative shadow-lg min-h-[500px]">
          <MapContainer center={[22.632, 88.435]} zoom={13} style={{ height: '100%', width: '100%', backgroundColor: '#0B1120' }}>
            <TileLayer 
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
              className="map-tiles"
            />
            <Circle center={[22.632, 88.435]} pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 2 }} radius={400} />
            {timeStep !== 'NOW' && (
              <Circle center={[22.632, 88.435]} pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 0.15, weight: 2, dashArray: '10, 10' }} radius={getRadius()} />
            )}
          </MapContainer>
          
          <div className="absolute bottom-4 left-4 z-[400] bg-[#111827]/90 backdrop-blur border border-slate-700 p-3 rounded-lg flex gap-4 text-xs font-bold text-slate-300">
             <span className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500/50 border border-blue-500 rounded-full"></div> Current Zone</span>
             <span className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500/30 border border-rose-500 border-dashed rounded-full"></div> Predicted Spread</span>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-700/50 rounded-xl p-5 shadow-lg flex flex-col overflow-y-auto min-h-[400px]">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Settings2 size={18} className="text-blue-400"/> Simulation Variables
          </h2>
          
          <div className="space-y-4 mb-8">
            <div className="bg-[#1A2332] p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><CloudRain size={16}/> Rainfall</div>
              <div className="font-bold text-white text-sm">47 mm/hr</div>
            </div>
            <div className="bg-[#1A2332] p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Droplets size={16}/> Water Level</div>
              <div className="font-bold text-white text-sm">82 cm</div>
            </div>
            <div className="bg-[#1A2332] p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Wind size={16}/> Wind Speed</div>
              <div className="font-bold text-white text-sm">18 km/h</div>
            </div>
            <div className="bg-[#1A2332] p-3 rounded-lg border border-slate-700/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-slate-400 text-sm"><Navigation size={16}/> Direction</div>
              <div className="font-bold text-white text-sm">South-East</div>
            </div>
          </div>

          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 border-t border-slate-700/50 pt-6">
            Map Layers
          </h2>
          
          <div className="space-y-4 pt-2">
            {[
              { id: 'population', label: 'Population Layer' },
              { id: 'shelters', label: 'Safe Shelters' },
              { id: 'roads', label: 'Road Network' }
            ].map(layer => (
              <div key={layer.id} className="flex justify-between items-center">
                <span className="text-sm text-slate-300">{layer.label}</span>
                
                {/* Custom Uiverse Toggle Integration */}
                <label className="switch cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={controls[layer.id]}
                    onChange={() => setControls(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))}
                  />
                  <div className="slider">
                    <div className="circle">
                      <svg className="cross" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      <svg className="checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  </div>
                </label>

              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}