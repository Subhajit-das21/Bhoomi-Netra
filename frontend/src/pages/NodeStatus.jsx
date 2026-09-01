import { Battery, BatteryCharging, Wifi, Radio, SignalHigh, SignalZero } from 'lucide-react';

const hardwareNodes = [
  { id: 'BN-01', location: 'River Bank A', status: 'Online', battery: 92, charging: true, comms: 'Wi-Fi', signal: 'Strong' },
  { id: 'BN-02', location: 'Forest Edge B', status: 'Online', battery: 85, charging: false, comms: 'GSM', signal: 'Fair' },
  { id: 'BN-03', location: 'Deep Valley C', status: 'Offline', battery: 0, charging: false, comms: 'LoRa', signal: 'Lost' },
];

export default function NodeStatus() {
  return (
    <div className="h-full">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Hardware Fleet Status</h2>
      
      {/* Grid Layout: Responsive columns based on screen size */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {hardwareNodes.map((node) => (
          <div 
            key={node.id} 
            className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default"
          >
            {/* Card Header with Dynamic Badge */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
              <h3 className="text-lg font-bold text-slate-800">{node.id}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                node.status === 'Online' 
                  ? 'bg-emerald-100 text-emerald-700' 
                  : 'bg-rose-100 text-rose-700'
              }`}>
                {node.status}
              </span>
            </div>
            
            <p className="text-sm text-slate-500 mb-6 font-medium">{node.location}</p>
            
            {/* Telemetry Metrics */}
            <div className="flex flex-col gap-4 text-sm text-slate-700">
              
              <div className="flex items-center gap-3">
                {node.charging ? (
                  <BatteryCharging size={20} className="text-emerald-500" />
                ) : (
                  <Battery size={20} className={node.battery > 20 ? "text-slate-400" : "text-rose-500"} />
                )}
                <span className="font-medium">Battery: {node.battery}%</span>
              </div>
              
              <div className="flex items-center gap-3">
                {node.comms === 'Wi-Fi' ? (
                  <Wifi size={20} className="text-blue-500" />
                ) : (
                  <Radio size={20} className="text-purple-500" />
                )}
                <span className="font-medium">Active Link: {node.comms}</span>
              </div>

              <div className="flex items-center gap-3">
                {node.signal === 'Lost' ? (
                  <SignalZero size={20} className="text-rose-500" />
                ) : (
                  <SignalHigh size={20} className={node.signal === 'Strong' ? "text-emerald-500" : "text-amber-500"} />
                )}
                <span className="font-medium">Signal: {node.signal}</span>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}