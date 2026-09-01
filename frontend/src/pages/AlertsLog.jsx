import { Filter, Download } from 'lucide-react';

const alertsData = [
  { id: 1, time: '14:32', location: 'Rajarhat', hazard: 'Flood', severity: 'Critical', confidence: '94%', status: 'Active' },
  { id: 2, time: '13:47', location: 'Sundarbans', hazard: 'Fire', severity: 'High', confidence: '89%', status: 'Active' },
  { id: 3, time: '09:20', location: 'Howrah', hazard: 'Air Quality', severity: 'Medium', confidence: '72%', status: 'Monitoring' },
  { id: 4, time: '08:45', location: 'Dibrugarh', hazard: 'Flood', severity: 'Low', confidence: '65%', status: 'Resolved' },
  { id: 5, time: '08:10', location: 'Pune', hazard: 'Heat', severity: 'High', confidence: '81%', status: 'Active' },
];

export default function AlertsLog() {
  const getSeverityStyle = (severity) => {
    switch(severity) {
      case 'Critical': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'High': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'Medium': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Low': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'Active': return 'text-rose-400 flex items-center gap-1.5';
      case 'Monitoring': return 'text-amber-400 flex items-center gap-1.5';
      case 'Resolved': return 'text-emerald-400 flex items-center gap-1.5';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="h-full bg-[#0B1120] text-slate-200 p-6 flex flex-col font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">System Alerts Log</h1>
          <p className="text-sm text-slate-400">Historical record of all detected hazards and system events</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-[#111827] border border-slate-700 hover:bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
            <Filter size={16} /> Filter
          </button>
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-colors">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 bg-[#111827] border border-slate-700/50 rounded-xl shadow-lg flex flex-col overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#151D2C] border-b border-slate-700/50 text-slate-400">
              <tr>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Hazard</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Severity</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider">Confidence</th>
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {alertsData.map((alert) => (
                <tr key={alert.id} className="transition-colors hover:bg-[#1A2332] group">
                  <td className="px-6 py-4 font-bold text-slate-300">{alert.time}</td>
                  <td className="px-6 py-4 font-medium text-white">{alert.location}</td>
                  <td className="px-6 py-4 text-slate-300">{alert.hazard}</td>
                  <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded text-xs font-bold uppercase border ${getSeverityStyle(alert.severity)}`}>{alert.severity}</span></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-400">{alert.confidence}</span>
                      <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: alert.confidence }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`font-bold justify-end uppercase text-xs tracking-wider ${getStatusStyle(alert.status)}`}>
                      {alert.status === 'Active' && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse mr-1"></span>}
                      {alert.status}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}