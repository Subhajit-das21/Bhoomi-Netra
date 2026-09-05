import React from 'react';
import { Layers, X, Droplets, Flame, Activity, Cloud, CloudRain, Wind, AlertTriangle, AlertOctagon, Radio, ShieldPlus, Users, MessageSquare, LifeBuoy } from 'lucide-react';

const LAYER_GROUPS = [
  {
    title: 'HAZARDS',
    icon: AlertTriangle,
    items: [
      { id: 'flood', label: 'Flood Zones', icon: Droplets, color: 'bg-amber-500' },
      { id: 'fire', label: 'Fire Zones', icon: Flame, color: 'bg-rose-500' },
      { id: 'earthquakes', label: 'Earthquakes', icon: Activity, color: 'bg-orange-500' },
      { id: 'nasaFires', label: 'NASA Fire Hotspots', icon: Flame, color: 'bg-red-500' },
    ]
  },
  {
    title: 'ENVIRONMENT',
    icon: Cloud,
    items: [
      { id: 'weather', label: 'Weather Overlay', icon: CloudRain, color: 'bg-blue-500' },
      { id: 'airQuality', label: 'Air Quality', icon: Wind, color: 'bg-purple-500' },
      { id: 'disasterZones', label: 'Disaster Zones', icon: AlertOctagon, color: 'bg-red-500' },
    ]
  },
  {
    title: 'INFRASTRUCTURE',
    icon: Radio,
    items: [
      { id: 'nodes', label: 'Sensor Nodes', icon: Radio, color: 'bg-emerald-400' },
      { id: 'shelters', label: 'Safe Shelters', icon: ShieldPlus, color: 'bg-emerald-500' },
    ]
  },
  {
    title: 'COMMUNITY',
    icon: Users,
    items: [
      { id: 'population', label: 'Population Density', icon: Users, color: 'bg-purple-500' },
      { id: 'communityReports', label: 'Community Reports', icon: MessageSquare, color: 'bg-cyan-400' },
      { id: 'sosBeacons', label: 'SOS Beacons', icon: LifeBuoy, color: 'bg-rose-500' },
    ]
  }
];

export default function LayerPanel({ layers = {}, onToggle, entityCounts = {}, onClose }) {
  return (
    <div className="absolute top-4 left-4 z-[400] bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl w-64 max-h-[calc(100vh-200px)] overflow-y-auto font-mono text-xs text-white/80 select-none scrollbar-hide animate-slide-in-left">
      <div className="sticky top-0 bg-[#0a0a0a]/95 border-b border-white/10 p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-amber-500 font-bold">
          <Layers size={16} />
          <span>INTEL LAYERS</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="p-4 flex flex-col gap-6">
        {LAYER_GROUPS.map((group, groupIdx) => (
          <div key={groupIdx}>
            <div className="flex items-center gap-2 text-white/40 mb-3 uppercase tracking-wider text-[10px] font-bold">
              <group.icon size={12} />
              <span>{group.title}</span>
            </div>
            
            <div className="flex flex-col gap-3">
              {group.items.map(item => {
                const isActive = !!layers[item.id];
                const count = entityCounts[item.id] || 0;
                
                return (
                  <div key={item.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isActive ? item.color : 'bg-white/10'}`} />
                      <item.icon size={14} className={isActive ? 'text-white' : 'text-white/40'} />
                      <span className={`transition-colors ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/70'}`}>
                        {item.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isActive && count > 0 && (
                        <span className="bg-white/10 text-white/80 text-[10px] px-1.5 py-0.5 rounded">
                          {count}
                        </span>
                      )}
                      
                      <div 
                        onClick={() => onToggle && onToggle(item.id)}
                        className={`w-8 h-4 rounded-full flex items-center cursor-pointer transition-colors p-0.5 ${isActive ? 'bg-amber-500' : 'bg-white/10 hover:bg-white/20'}`}
                      >
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ${isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
