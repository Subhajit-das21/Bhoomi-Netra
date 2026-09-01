import { useState } from 'react';
import { Radio, Battery, Wifi, Droplets, Thermometer, CloudFog, Activity, CloudRain } from 'lucide-react';

const mockNodes = [
  { id: 'BN-01', location: 'Rajarhat', type: 'Flood', status: 'Normal', battery: 91, network: 'WiFi', lastSync: '2 sec ago' },
  { id: 'BN-02', location: 'Sundarbans', type: 'Fire', status: 'Warning', battery: 76, network: 'LoRa', lastSync: '15 sec ago' },
  { id: 'BN-03', location: 'Rajarhat', type: 'Flood', status: 'CRITICAL', battery: 82, network: 'LoRa', lastSync: '8 sec ago' },
];

export default function SensorNodes() {
  const [selectedNode, setSelectedNode] = useState(mockNodes[2]); // Defaulting to the critical one for demonstration

  return (
    <div className="h-full bg-black text-white/80 p-6 flex flex-col font-mono">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Sensor Fleet Management</h1>
          <p className="text-sm text-white/50">Hardware status and live telemetry</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 xl:grid-cols-3 gap-6 min-h-0">
        
        {/* Left Side: Nodes Table */}
        <div className="xl:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-xl shadow-lg flex flex-col overflow-hidden">
          <div className="p-4 bg-[#0a0a0a] border-b border-white/10 flex justify-between items-center">
            <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider">Active Nodes</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.05] text-white/50">
                <tr>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Node</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Location</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Type</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Battery</th>
                  <th className="px-6 py-4 font-bold uppercase tracking-wider">Network</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {mockNodes.map((node) => (
                  <tr 
                    key={node.id} 
                    onClick={() => setSelectedNode(node)}
                    className={`cursor-pointer transition-colors hover:bg-white/[0.08] ${selectedNode?.id === node.id ? 'bg-white/[0.08]' : ''}`}
                  >
                    <td className="px-6 py-4 font-bold text-white">{node.id}</td>
                    <td className="px-6 py-4 text-white/70">{node.location}</td>
                    <td className="px-6 py-4 text-white/70">{node.type}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                        node.status === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                        node.status === 'Warning' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {node.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white/70 flex items-center gap-2">
                      <Battery size={16} className={node.battery > 20 ? 'text-emerald-400' : 'text-rose-400'}/> {node.battery}%
                    </td>
                    <td className="px-6 py-4 text-white/70">
                      <div className="flex items-center gap-2">
                        {node.network === 'WiFi' ? <Wifi size={16} className="text-amber-400"/> : <Radio size={16} className="text-purple-400"/>}
                        {node.network}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Node Detail Panel */}
        {selectedNode && (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 shadow-lg flex flex-col overflow-y-auto">
            
            {/* Header */}
            <div className="border-b border-white/10 pb-4 mb-4">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Activity size={20} className="text-amber-400"/> NODE {selectedNode.id}
                </h2>
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${selectedNode.status === 'CRITICAL' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {selectedNode.status}
                </span>
              </div>
              <p className="text-sm text-white/50">{selectedNode.location} • {selectedNode.type} Sensor</p>
            </div>

            {/* Vital Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-white/[0.05] p-3 rounded-lg border border-white/10">
                <div className="text-white/30 text-xs mb-1 flex items-center gap-1"><Battery size={12}/> Battery</div>
                <div className="text-lg font-bold text-white">{selectedNode.battery}%</div>
              </div>
              <div className="bg-white/[0.05] p-3 rounded-lg border border-white/10">
                <div className="text-white/30 text-xs mb-1 flex items-center gap-1"><Radio size={12}/> Network</div>
                <div className="text-lg font-bold text-white">{selectedNode.network}</div>
              </div>
            </div>

            {/* Telemetry Readings */}
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Live Telemetry</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center bg-black p-3 rounded border border-white/10">
                <span className="text-sm text-white/50 flex items-center gap-2"><Droplets size={16}/> Water Level</span>
                <span className="font-bold text-white">82 cm ⬆</span>
              </div>
              <div className="flex justify-between items-center bg-black p-3 rounded border border-white/10">
                <span className="text-sm text-white/50 flex items-center gap-2"><CloudRain size={16}/> Rainfall</span>
                <span className="font-bold text-white">47 mm/hr</span>
              </div>
              <div className="flex justify-between items-center bg-black p-3 rounded border border-white/10">
                <span className="text-sm text-white/50 flex items-center gap-2"><Thermometer size={16}/> Temperature</span>
                <span className="font-bold text-white">31°C</span>
              </div>
              <div className="flex justify-between items-center bg-black p-3 rounded border border-white/10">
                <span className="text-sm text-white/50 flex items-center gap-2"><CloudFog size={16}/> Humidity</span>
                <span className="font-bold text-white">89%</span>
              </div>
            </div>

            <div className="mt-auto text-xs text-center text-white/30 font-medium">
              Last Sync: {selectedNode.lastSync}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}