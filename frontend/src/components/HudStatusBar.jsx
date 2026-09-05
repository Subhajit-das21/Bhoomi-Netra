import React, { useState, useEffect } from 'react';

export default function HudStatusBar({ entityCount = 0, backendStatus = 'connecting', mouseCoords, locationLabel }) {
  const [zuluTime, setZuluTime] = useState('');
  const [uptimeSeconds, setUptimeSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      
      const hh = String(now.getUTCHours()).padStart(2, '0');
      const mm = String(now.getUTCMinutes()).padStart(2, '0');
      const ss = String(now.getUTCSeconds()).padStart(2, '0');
      setZuluTime(`ZULU ${hh}:${mm}:${ss}Z`);

      setUptimeSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (totalSeconds) => {
    const h = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    return `UPTIME: ${h}:${m}:${s}`;
  };

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'connected': return 'bg-emerald-400';
      case 'error': return 'bg-rose-500';
      case 'connecting':
      default: return 'bg-yellow-400';
    }
  };

  return (
    <div className="absolute bottom-0 w-full h-8 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/10 text-[10px] font-mono flex items-center justify-between px-4 z-[400] text-white/80 tabular-nums">
      
      <div className="flex items-center gap-6">
        {/* Backend Status */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
          <span className="uppercase">{backendStatus}</span>
        </div>

        {/* Clocks */}
        <div className="text-cyan-400">{zuluTime || 'ZULU --:--:--Z'}</div>
        <div className="text-amber-500">{formatUptime(uptimeSeconds)}</div>
        
        {/* Entity Count */}
        <div className="text-emerald-400">ENTITIES: {entityCount}</div>
      </div>

      <div className="flex items-center gap-6">
        {/* Mouse Coords */}
        {mouseCoords && (
          <div className="text-white/50">
            LAT: {mouseCoords.lat?.toFixed(5)} LNG: {mouseCoords.lng?.toFixed(5)}
          </div>
        )}
        
        {/* Location Label */}
        {locationLabel && (
          <div className="text-amber-500/80 uppercase max-w-[200px] truncate">
            {locationLabel}
          </div>
        )}
      </div>
    </div>
  );
}
