import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';

// Import all your new pages!
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import AlertsLog from './pages/AlertsLog';
import SensorNodes from './pages/SensorNodes'; // We renamed this from NodeStatus
import Simulation from './pages/Simulation';
import PopulationRisk from './pages/PopulationRisk';
import CommunityAlerts from './pages/CommunityAlerts';
import SOS from './pages/SOS';
import Analytics from './pages/Analytics';

export default function App() {
  return (
    <Router>
      {/* The main wrapper uses the dark background #0B1120 */}
      <div className="flex h-screen w-full font-sans bg-[#0B1120] overflow-hidden">
        
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 h-full overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/map" element={<LiveMap />} />
            <Route path="/alerts" element={<AlertsLog />} />
            <Route path="/nodes" element={<SensorNodes />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/population" element={<PopulationRisk />} />
            <Route path="/community-alerts" element={<CommunityAlerts />} />
            <Route path="/sos" element={<SOS />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </div>
        
      </div>
    </Router>
  );
}