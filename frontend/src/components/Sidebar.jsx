import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Map, 
  AlertTriangle, 
  Radio, 
  Activity, 
  Users, 
  MessageSquare, 
  LifeBuoy, 
  BarChart3 
} from 'lucide-react';

export default function Sidebar() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const baseLinkClass = "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm";
  const activeClass = "bg-amber-500/10 text-amber-400 border border-amber-500/50 shadow-sm";
  const inactiveClass = "text-white/40 hover:bg-white/[0.05] hover:text-white/80 border border-transparent";

  const navItems = [
    { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { path: '/map', label: 'Live Map', icon: <Map size={18} /> },
    { path: '/alerts', label: 'Alerts Log', icon: <AlertTriangle size={18} /> },
    { path: '/nodes', label: 'Sensor Nodes', icon: <Radio size={18} /> },
    { path: '/simulation', label: 'Spread Simulation', icon: <Activity size={18} /> },
    { path: '/population', label: 'Population at Risk', icon: <Users size={18} /> },
    { path: '/community-alerts', label: 'Community Alerts', icon: <MessageSquare size={18} /> },
    { path: '/sos', label: 'SOS & Emergency', icon: <LifeBuoy size={18} /> },
    { path: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  ];

  return (
    <div className="w-64 h-full bg-[#0a0a0a] border-r border-white/10 flex flex-col z-20 overflow-y-auto font-mono">
      
      {/* Branding Header */}
      <div className="p-6 sticky top-0 bg-[#0a0a0a] z-10 border-b border-white/10">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 tracking-wide">
          🌱 BHOOMI-NETRA
        </h2>
        <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1 font-bold">
          Command Center
        </p>
      </div>
      
      {/* Navigation Links */}
      <nav className="flex flex-col gap-2 p-4">
        {navItems.map((item) => (
          <Link 
            key={item.path}
            to={item.path} 
            className={`${baseLinkClass} ${isActive(item.path) ? activeClass : inactiveClass}`}
          >
            {item.icon} {item.label}
          </Link>
        ))}
      </nav>
      
    </div>
  );
}