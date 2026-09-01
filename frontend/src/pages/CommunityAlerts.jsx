import { useState } from 'react';
import { 
  Send, 
  Smartphone, 
  MessageSquare, 
  Users, 
  Radio, 
  CheckCircle, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';

export default function CommunityAlerts() {
  const [radius, setRadius] = useState(2.5);
  const [channels, setChannels] = useState({ app: true, sms: true });
  const [message, setMessage] = useState(
    'Water level is rising rapidly. Move to higher ground and follow instructions from local authorities.'
  );
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);

  const handleSend = (e) => {
    e.preventDefault();
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      setSentSuccess(true);
    }, 1200);
  };

  const toggleChannel = (channel) => {
    setChannels((prev) => ({ ...prev, [channel]: !prev[channel] }));
  };

  return (
    <div className="h-full bg-black text-white/80 p-6 flex flex-col font-mono overflow-y-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Community Broadcast Control</h1>
          <p className="text-sm text-white/50">Multi-channel emergency broadcast system</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Broadcast Engine Ready</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Alert Composer Form */}
        <div className="xl:col-span-2 bg-[#0a0a0a] border border-white/10 rounded-xl p-6 shadow-lg">
          <h2 className="text-base font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-white/10 pb-3">
            <Radio size={18} className="text-amber-400" /> Draft Emergency Alert
          </h2>

          <form onSubmit={handleSend} className="space-y-6">
            
            {/* Target Incident & Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                  Target Hazard
                </label>
                <div className="bg-white/[0.05] border border-white/10 rounded-lg p-3 text-sm font-medium text-white flex items-center justify-between">
                  <span>Critical Flood Risk</span>
                  <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded font-bold uppercase">
                    Level 3
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                  Target Zone
                </label>
                <div className="bg-white/[0.05] border border-white/10 rounded-lg p-3 text-sm font-medium text-white">
                  Rajarhat, Kolkata Sector V
                </div>
              </div>
            </div>

            {/* Alert Radius Slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                  Broadcast Radius
                </label>
                <span className="text-sm font-bold text-amber-400">{radius} km</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="10" 
                step="0.5" 
                value={radius} 
                onChange={(e) => setRadius(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>0.5 km</span>
                <span>5.0 km</span>
                <span>10.0 km</span>
              </div>
            </div>

            {/* Distribution Channels */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-3">
                Delivery Channels
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <label 
                  onClick={() => toggleChannel('app')}
                  className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                    channels.app 
                      ? 'bg-amber-500/10 border-amber-500 text-white' 
                      : 'bg-white/[0.05] border-white/10 text-white/50'
                  }`}
                >
                  <Smartphone size={20} className={channels.app ? 'text-amber-400' : 'text-white/30'} />
                  <div>
                    <div className="text-sm font-bold">Mobile App Push</div>
                    <div className="text-xs text-white/50">Direct alert to Bhoomi-Netra app users</div>
                  </div>
                </label>

                <label 
                  onClick={() => toggleChannel('sms')}
                  className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${
                    channels.sms 
                      ? 'bg-amber-500/10 border-amber-500 text-white' 
                      : 'bg-white/[0.05] border-white/10 text-white/50'
                  }`}
                >
                  <MessageSquare size={20} className={channels.sms ? 'text-amber-400' : 'text-white/30'} />
                  <div>
                    <div className="text-sm font-bold">SMS Fallback</div>
                    <div className="text-xs text-white/50">Carrier broadcast for low-connectivity zones</div>
                  </div>
                </label>

              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/50 mb-2">
                Emergency Message
              </label>
              <textarea 
                rows="4" 
                value={message} 
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors resize-none leading-relaxed"
              />
            </div>

            {/* Send Button */}
            <button 
              type="submit" 
              disabled={isSending}
              className="w-full bg-rose-600 hover:bg-rose-500 disabled:bg-slate-700 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-rose-900/30 transition-colors flex items-center justify-center gap-2"
            >
              {isSending ? (
                <>Dispatching Gateway Packets...</>
              ) : (
                <>
                  <Send size={18} /> SEND EMERGENCY ALERT
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right 1 Column: Target Population & Delivery Status */}
        <div className="space-y-6">
          
          {/* Population Summary Card */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 shadow-lg">
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={16} className="text-amber-400" /> Projected Reach
            </h3>
            <div className="text-3xl font-bold text-white mb-1">8,200</div>
            <p className="text-xs text-white/50 mb-4">Citizens estimated within {radius} km radius</p>
            
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-200/90 leading-relaxed">
                Critical severity level will trigger loud bypass notification profiles on registered user devices.
              </p>
            </div>
          </div>

          {/* Delivery Telemetry Feed */}
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider">
                Broadcast Metrics
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                sentSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/50'
              }`}>
                {sentSuccess ? 'Delivered' : 'Standing By'}
              </span>
            </div>

            <div className="space-y-4">
              <div className="bg-white/[0.05] p-3 rounded-lg flex justify-between items-center border border-white/10">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Smartphone size={16} className="text-amber-400" /> App Delivered
                </div>
                <div className="text-base font-bold text-white">6,430</div>
              </div>

              <div className="bg-white/[0.05] p-3 rounded-lg flex justify-between items-center border border-white/10">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <MessageSquare size={16} className="text-purple-400" /> SMS Delivered
                </div>
                <div className="text-base font-bold text-white">1,620</div>
              </div>

              <div className="bg-white/[0.05] p-3 rounded-lg flex justify-between items-center border border-white/10">
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <Clock size={16} className="text-amber-400" /> Pending
                </div>
                <div className="text-base font-bold text-white">150</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-white/30">
              <span>Delivery Rate</span>
              <span className="text-emerald-400 font-bold">98.2%</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}