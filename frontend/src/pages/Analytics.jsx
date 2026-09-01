import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Activity, BarChart3, AlertTriangle } from 'lucide-react';

const weeklyData = [
  { name: 'Mon', Flood: 12, Fire: 5, AirQuality: 18 },
  { name: 'Tue', Flood: 19, Fire: 8, AirQuality: 15 },
  { name: 'Wed', Flood: 15, Fire: 12, AirQuality: 22 },
  { name: 'Thu', Flood: 28, Fire: 4, AirQuality: 10 },
  { name: 'Fri', Flood: 22, Fire: 10, AirQuality: 14 },
  { name: 'Sat', Flood: 18, Fire: 7, AirQuality: 19 },
  { name: 'Sun', Flood: 25, Fire: 9, AirQuality: 24 },
];

export default function Analytics() {
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#151D2C] border border-slate-700 p-4 rounded-lg shadow-xl">
          <p className="text-white font-bold mb-2 border-b border-slate-700 pb-2">{label} - Incident Report</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex justify-between items-center gap-4 text-sm mb-1">
              <span style={{ color: entry.color }} className="font-medium">{entry.name}:</span>
              <span className="text-white font-bold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full bg-[#0B1120] text-slate-200 p-6 flex flex-col font-sans overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">System Analytics</h1>
          <p className="text-sm text-slate-400">Trends, charts, and insights for decision making</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-lg flex items-center gap-3">
          <TrendingUp size={20} className="text-blue-400" />
          <div>
            <div className="text-xs text-blue-400 font-bold uppercase tracking-wide">Data Range</div>
            <div className="text-sm font-bold text-white leading-tight">This Week (Last 7 Days)</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-[#111827] border border-slate-700/50 p-5 rounded-xl shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Incidents</div>
            <div className="text-3xl font-bold text-white">283</div>
            <div className="text-xs text-emerald-400 font-medium mt-1">↓ 12% from last week</div>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><BarChart3 size={24} /></div>
        </div>
        <div className="bg-[#111827] border border-slate-700/50 p-5 rounded-xl shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">High Severity Ratio</div>
            <div className="text-3xl font-bold text-rose-400">18.4%</div>
            <div className="text-xs text-rose-400 font-medium mt-1">↑ 2.1% from last week</div>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-lg text-rose-400"><AlertTriangle size={24} /></div>
        </div>
        <div className="bg-[#111827] border border-slate-700/50 p-5 rounded-xl shadow-lg flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">System Uptime</div>
            <div className="text-3xl font-bold text-emerald-400">99.8%</div>
            <div className="text-xs text-slate-400 font-medium mt-1">Across 128 nodes</div>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400"><Activity size={24} /></div>
        </div>
      </div>

      <div className="flex-1 bg-[#111827] border border-slate-700/50 rounded-xl p-6 shadow-lg min-h-[400px] flex flex-col">
        <h2 className="text-base font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
          Incident Trend (This Week)
        </h2>
        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#64748b" tick={{ fill: '#64748b', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="Flood" name="Flood (Blue)" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="Fire" name="Fire (Orange)" fill="#f97316" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="AirQuality" name="Air Quality (Amber)" fill="#fbbf24" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}