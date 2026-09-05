import React, { useState } from 'react';
import { X, Newspaper, AlertTriangle, Flame, Activity, Radio, Droplets } from 'lucide-react';

const getRelativeTime = (timestamp) => {
  if (!timestamp) return 'just now';
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hr ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
};

const SEVERITY_COLORS = {
  critical: 'bg-rose-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-white/30'
};

const TYPE_ICONS = {
  seismic: Activity,
  fire: Flame,
  flood: Droplets,
  sensor: Radio,
  alert: AlertTriangle
};

const TABS = ['ALL', 'CRITICAL', 'SEISMIC', 'FIRE', 'SENSOR'];

export default function IntelFeed({ events = [], visible = false, onClose, onFlyTo }) {
  const [activeTab, setActiveTab] = useState('ALL');

  const filteredEvents = events.filter(e => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'CRITICAL') return e.severity === 'critical';
    return e.type.toUpperCase() === activeTab;
  });

  return (
    <div className={`absolute top-0 right-0 h-full w-80 bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[500] transition-transform duration-300 flex flex-col font-mono text-xs ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2 text-amber-500 font-bold">
          <Newspaper size={16} />
          <span>INTEL FEED</span>
        </div>
        <button onClick={onClose} className="text-white/50 hover:text-white">
          <X size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-white/10">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 shrink-0 transition-colors ${activeTab === tab ? 'text-amber-500 border-b-2 border-amber-500 bg-white/5' : 'text-white/40 hover:text-white/70'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {filteredEvents.length === 0 ? (
          <div className="text-center text-white/30 py-8">NO EVENTS FOUND</div>
        ) : (
          filteredEvents.map(event => {
            const Icon = TYPE_ICONS[event.type] || AlertTriangle;
            const severityColor = SEVERITY_COLORS[event.severity] || SEVERITY_COLORS.low;

            return (
              <div 
                key={event.id}
                onClick={() => onFlyTo && onFlyTo(event.lat, event.lng)}
                className="bg-white/[0.03] border border-white/5 p-3 rounded-lg hover:bg-white/[0.06] hover:border-white/10 cursor-pointer transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${severityColor}`} />
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={12} className="text-white/40 group-hover:text-white/70" />
                      <span className="font-bold text-white/90">{event.title}</span>
                    </div>
                    
                    <div className="text-white/50 text-[10px] mb-2">{event.location}</div>
                    
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-white/30">{getRelativeTime(event.time)}</span>
                      {event.details && (
                        <span className="text-amber-500/70">{event.details}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
