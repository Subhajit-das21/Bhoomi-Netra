import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import { ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { MapView } from '@deck.gl/core';
import DeckGL from '@deck.gl/react';
import {
  Layers, X, Droplets, AlertOctagon, Users, ShieldPlus, CloudRain,
  Flame, Wind, Activity, Radio, Newspaper, Search, Crosshair,
  AlertTriangle, Maximize, LifeBuoy, MessageSquare, Cloud,
  Eye, EyeOff, Thermometer, Gauge
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchEarthquakes } from '../lib/earthquakeApi';
import { fetchWeather } from '../lib/weatherApi';
import { fetchActiveFires } from '../lib/nasaFiresApi';
import HudStatusBar from '../components/HudStatusBar';
import LayerPanel from '../components/LayerPanel';
import IntelFeed from '../components/IntelFeed';
import SplashScreen from '../components/SplashScreen';

// ── DARK MAP STYLE (CartoDB Dark Matter — free, no API key) ──
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

// ── DISASTER ZONES — severity-coded warning areas (Osiris-style conflict zones) ──
const DISASTER_ZONES = [
  { id: 'dz-1', name: 'Sundarbans Flood Plain', lat: 21.95, lng: 88.90, radius: 25000, severity: 'critical', type: 'flood', description: 'Chronic cyclone and tidal flooding corridor' },
  { id: 'dz-2', name: 'Rajarhat Low-Lying Basin', lat: 22.632, lng: 88.435, radius: 8000, severity: 'high', type: 'flood', description: 'Urban flood accumulation zone — poor drainage' },
  { id: 'dz-3', name: 'Jhargram Forest Fire Belt', lat: 22.45, lng: 86.99, radius: 15000, severity: 'high', type: 'fire', description: 'Dense deciduous forest — high fire risk in dry season' },
  { id: 'dz-4', name: 'Digha Coastal Erosion Zone', lat: 21.63, lng: 87.55, radius: 10000, severity: 'medium', type: 'erosion', description: 'Active coastal erosion — 3m/year retreat' },
  { id: 'dz-5', name: 'Hooghly Industrial Corridor', lat: 22.90, lng: 88.39, radius: 12000, severity: 'medium', type: 'air_quality', description: 'Heavy industrial emissions — AQI regularly above 200' },
  { id: 'dz-6', name: 'Darjeeling Landslide Belt', lat: 27.04, lng: 88.26, radius: 20000, severity: 'critical', type: 'landslide', description: 'Active landslide zone — monsoon season risk' },
];

const SEVERITY_COLORS = {
  critical: [239, 68, 68],    // rose-500
  high: [249, 115, 22],       // orange-500
  medium: [245, 158, 11],     // amber-500
  low: [156, 163, 175],       // gray-400
};

const SEVERITY_RING_COLORS = {
  critical: [239, 68, 68, 60],
  high: [249, 115, 22, 40],
  medium: [245, 158, 11, 30],
  low: [156, 163, 175, 20],
};

// ── ZULU CLOCK ──
function ZuluClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setTime(`ZULU ${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}Z`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="text-cyan-400 font-bold tabular-nums">{time || 'ZULU --:--:--Z'}</span>;
}

// ── UPTIME CLOCK ──
function UptimeClock() {
  const [uptime, setUptime] = useState('00:00:00');
  const startRef = useRef(Date.now());
  useEffect(() => {
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - startRef.current) / 1000);
      setUptime(`${String(Math.floor(e / 3600)).padStart(2, '0')}:${String(Math.floor((e % 3600) / 60)).padStart(2, '0')}:${String(e % 60).padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(iv);
  }, []);
  return <span>UPTIME: <span className="text-amber-400">{uptime}</span></span>;
}

// ── RELATIVE TIME HELPER ──
function getRelativeTime(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function LiveMap() {
  // ── STATE ──
  const [showSplash, setShowSplash] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL HAZARDS');
  const [viewState, setViewState] = useState({
    longitude: 88.43, latitude: 22.63, zoom: 10,
    pitch: 0, bearing: 0,
  });

  // ── LAYERS ──
  const [layers, setLayers] = useState({
    nodes: true, flood: true, fire: true, shelters: true, population: false,
    earthquakes: true, nasaFires: true, weather: true, airQuality: false,
    disasterZones: true, communityReports: false, sosBeacons: false,
  });

  // ── DATA ──
  const [nodes, setNodes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [earthquakes, setEarthquakes] = useState([]);
  const [fires, setFires] = useState([]);
  const [weather, setWeather] = useState(null);
  const [intelEvents, setIntelEvents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);

  // ── UI STATE ──
  const [showLayers, setShowLayers] = useState(true);
  const [showIntel, setShowIntel] = useState(false);
  const [backendStatus, setBackendStatus] = useState('connecting');
  const [mouseCoords, setMouseCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');

  // ── REFS ──
  const geocodeCache = useRef(new Map());
  const geocodeTimer = useRef(null);
  const lastGeocodedPos = useRef(null);
  const layerFetchedRef = useRef({});

  // ── ENTITY COUNTS ──
  const entityCounts = useMemo(() => ({
    nodes: nodes.length,
    flood: alerts.filter(a => a.type === 'flood').length,
    fire: alerts.filter(a => a.type === 'fire').length,
    earthquakes: earthquakes.length,
    nasaFires: fires.length,
    disasterZones: DISASTER_ZONES.length,
    shelters: 0,
    population: 0,
    weather: weather ? 1 : 0,
    airQuality: 0,
    communityReports: 0,
    sosBeacons: 0,
  }), [nodes, alerts, earthquakes, fires, weather]);

  const totalEntities = useMemo(() =>
    Object.values(entityCounts).reduce((a, b) => a + b, 0),
  [entityCounts]);

  // ── FETCH SENSOR DATA FROM SUPABASE ──
  const fetchSensorData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const mockAlerts = [
        { id: 'BN-01', lat: 22.632, lng: 88.435, type: 'flood', status: 'critical', location: 'Rajarhat', confidence: '94%', waterLevel: '82 cm', rainfall: '47mm/hr', riskPop: '8,200', aiScore: '94%' },
        { id: 'BN-02', lat: 22.645, lng: 88.420, type: 'fire', status: 'high', location: 'Sundarbans Edge', confidence: '89%', wind: '18 km/h', temp: '38°C', riskPop: '1,200', aiScore: '89%' },
        { id: 'BN-03', lat: 22.58, lng: 88.45, type: 'flood', status: 'medium', location: 'Salt Lake', confidence: '76%', waterLevel: '35 cm', rainfall: '22mm/hr', riskPop: '3,400', aiScore: '76%' },
        { id: 'BN-04', lat: 22.70, lng: 88.38, type: 'fire', status: 'critical', location: 'Barasat Periphery', confidence: '91%', wind: '24 km/h', temp: '41°C', riskPop: '5,600', aiScore: '91%' },
      ];
      setAlerts(mockAlerts);
      setBackendStatus('connected');
      return;
    }

    try {
      const { data: nodesData } = await supabase.from('sensor_nodes').select('*');
      if (nodesData) setNodes(nodesData);

      const { data: alertsData } = await supabase
        .from('alerts').select('*, sensor_nodes(*)')
        .eq('resolved', false);

      if (alertsData) {
        const enriched = alertsData.map(a => ({
          id: a.id, lat: a.sensor_nodes?.latitude, lng: a.sensor_nodes?.longitude,
          type: a.hazard_type, status: a.severity,
          location: a.sensor_nodes?.name || 'Unknown Zone',
          confidence: '92%', riskPop: a.severity === 'critical' ? '12,500' : '3,200',
          aiScore: '92%'
        })).filter(a => a.lat && a.lng);
        setAlerts(enriched);
      }
      setBackendStatus('connected');
    } catch (err) {
      console.warn('[BHOOMI-NETRA] Sensor fetch error:', err);
      setBackendStatus('error');
    }
  }, []);

  // ── FETCH EXTERNAL INTELLIGENCE DATA ──
  const fetchIntelligenceData = useCallback(async () => {
    // Earthquakes
    if (!layerFetchedRef.current.earthquakes) {
      try {
        const eqData = await fetchEarthquakes();
        setEarthquakes(eqData);
        layerFetchedRef.current.earthquakes = true;

        // Add to intel events
        const eqEvents = eqData.slice(0, 10).map(eq => ({
          id: `eq-${eq.id}`, type: 'seismic', title: `M${eq.magnitude} Earthquake`,
          location: eq.place, severity: eq.magnitude >= 5 ? 'critical' : eq.magnitude >= 4 ? 'high' : 'medium',
          lat: eq.lat, lng: eq.lng, time: eq.time,
          details: `Depth: ${eq.depth}km${eq.tsunami ? ' ⚠️ TSUNAMI WARNING' : ''}`
        }));
        setIntelEvents(prev => [...eqEvents, ...prev].slice(0, 50));
      } catch (err) {
        console.warn('[BHOOMI-NETRA] Earthquake fetch error:', err);
      }
    }

    // NASA Fires
    if (!layerFetchedRef.current.fires) {
      try {
        const fireData = await fetchActiveFires();
        setFires(fireData);
        layerFetchedRef.current.fires = true;

        const fireEvents = fireData.slice(0, 5).map((f, i) => ({
          id: `fire-${i}`, type: 'fire', title: `Fire Hotspot Detected`,
          location: `${f.lat.toFixed(2)}°N, ${f.lng.toFixed(2)}°E`,
          severity: f.confidence === 'high' ? 'high' : 'medium',
          lat: f.lat, lng: f.lng, time: Date.now() - Math.random() * 3600000,
          details: `Brightness: ${f.brightness}K, FRP: ${f.frp}`
        }));
        setIntelEvents(prev => [...fireEvents, ...prev].slice(0, 50));
      } catch (err) {
        console.warn('[BHOOMI-NETRA] NASA fires fetch error:', err);
      }
    }

    // Weather
    try {
      const wxData = await fetchWeather(viewState.latitude, viewState.longitude);
      setWeather(wxData);
    } catch (err) {
      console.warn('[BHOOMI-NETRA] Weather fetch error:', err);
    }
  }, [viewState.latitude, viewState.longitude]);

  // ── INITIAL LOAD ──
  useEffect(() => {
    fetchSensorData();
    fetchIntelligenceData();

    // Add sensor alerts to intel events
    const sensorEvents = alerts.map(a => ({
      id: `sensor-${a.id}`, type: 'sensor', title: `${a.type.toUpperCase()} Alert: ${a.location}`,
      location: a.location, severity: a.status, lat: a.lat, lng: a.lng,
      time: Date.now() - Math.random() * 1800000,
      details: `AI Confidence: ${a.aiScore || 'N/A'}`
    }));
    if (sensorEvents.length > 0) {
      setIntelEvents(prev => [...sensorEvents, ...prev].slice(0, 50));
    }

    // Polling for external data (15 min)
    const pollInterval = setInterval(() => {
      layerFetchedRef.current = {};
      fetchIntelligenceData();
    }, 15 * 60 * 1000);

    return () => clearInterval(pollInterval);
  }, [fetchSensorData, fetchIntelligenceData]);

  // ── KEYBOARD SHORTCUTS ──
  useEffect(() => {
    const handler = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      if (e.key === 'f' && !e.ctrlKey) {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }
      if (e.key === 'l') setShowLayers(p => !p);
      if (e.key === 'i') setShowIntel(p => !p);
      if (e.key === 'Escape') {
        setSelectedIncident(null);
        setShowIntel(false);
      }
      if (e.key === 'r') {
        setViewState(v => ({ ...v, longitude: 88.43, latitude: 22.63, zoom: 10, pitch: 0, bearing: 0 }));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── MOUSE COORDS + REVERSE GEOCODE ──
  const handleMouseMove = useCallback((e) => {
    if (!e.coordinate) return;
    const [lng, lat] = e.coordinate;
    setMouseCoords({ lat: lat.toFixed(4), lng: lng.toFixed(4) });

    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      if (lastGeocodedPos.current) {
        const d = Math.abs(lat - lastGeocodedPos.current.lat) + Math.abs(lng - lastGeocodedPos.current.lng);
        if (d < 0.5) return;
      }
      const gk = `${lat.toFixed(1)},${lng.toFixed(1)}`;
      if (geocodeCache.current.has(gk)) {
        setLocationLabel(geocodeCache.current.get(gk));
        lastGeocodedPos.current = { lat, lng };
        return;
      }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        if (res.ok) {
          const d = await res.json();
          const a = d.address || {};
          const label = [a.city || a.town || a.village || a.county, a.state || a.region, a.country]
            .filter(Boolean).join(', ') || 'Unknown';
          if (geocodeCache.current.size > 500) {
            const it = geocodeCache.current.keys();
            for (let i = 0; i < 100; i++) { const k = it.next().value; if (k) geocodeCache.current.delete(k); }
          }
          geocodeCache.current.set(gk, label);
          setLocationLabel(label);
          lastGeocodedPos.current = { lat, lng };
        }
      } catch (err) {
        console.warn('[BHOOMI-NETRA] Geocode error:', err);
      }
    }, 3000);
  }, []);

  // ── LAYER TOGGLE ──
  const handleLayerToggle = useCallback((layerId) => {
    setLayers(prev => ({ ...prev, [layerId]: !prev[layerId] }));
  }, []);

  // ── FLY TO LOCATION ──
  const handleFlyTo = useCallback((lat, lng) => {
    setViewState(v => ({
      ...v, latitude: lat, longitude: lng, zoom: 12,
      transitionDuration: 1500,
    }));
  }, []);

  // ── BUILD DECK.GL LAYERS ──
  const deckLayers = useMemo(() => {
    const result = [];

    // === EARTHQUAKE LAYER ===
    if (layers.earthquakes && earthquakes.length > 0) {
      result.push(new ScatterplotLayer({
        id: 'earthquakes',
        data: earthquakes,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => Math.pow(2, d.magnitude) * 200,
        getFillColor: d => {
          if (d.magnitude >= 5) return [239, 68, 68, 200];
          if (d.magnitude >= 4) return [249, 115, 22, 180];
          return [245, 158, 11, 160];
        },
        getLineColor: d => {
          if (d.magnitude >= 5) return [239, 68, 68, 255];
          if (d.magnitude >= 4) return [249, 115, 22, 220];
          return [245, 158, 11, 200];
        },
        lineWidthMinPixels: 1,
        stroked: true,
        pickable: true,
        radiusMinPixels: 4,
        radiusMaxPixels: 40,
        onClick: ({ object }) => {
          if (object) {
            setSelectedIncident({
              id: object.id, type: 'earthquake', status: object.magnitude >= 5 ? 'critical' : 'high',
              location: object.place, lat: object.lat, lng: object.lng,
              magnitude: object.magnitude, depth: object.depth,
              tsunami: object.tsunami, aiScore: `M${object.magnitude}`,
              waterLevel: `${object.depth}km deep`, rainfall: getRelativeTime(object.time),
            });
          }
        },
      }));
    }

    // === NASA FIRES HEATMAP ===
    if (layers.nasaFires && fires.length > 0) {
      result.push(new HeatmapLayer({
        id: 'nasa-fires-heat',
        data: fires,
        getPosition: d => [d.lng, d.lat],
        getWeight: d => d.brightness ? d.brightness / 300 : 1,
        radiusPixels: 30,
        intensity: 1.5,
        threshold: 0.1,
        colorRange: [
          [255, 255, 178], [254, 204, 92], [253, 141, 60],
          [240, 59, 32], [189, 0, 38], [128, 0, 38],
        ],
      }));

      result.push(new ScatterplotLayer({
        id: 'nasa-fires-dots',
        data: fires.slice(0, 200),
        getPosition: d => [d.lng, d.lat],
        getRadius: 800,
        getFillColor: [255, 100, 30, 160],
        getLineColor: [255, 60, 0, 220],
        lineWidthMinPixels: 1,
        stroked: true,
        pickable: true,
        radiusMinPixels: 3,
        radiusMaxPixels: 12,
        onClick: ({ object }) => {
          if (object) {
            setSelectedIncident({
              id: `fire-${object.lat}-${object.lng}`, type: 'fire',
              status: 'high', location: `${object.lat.toFixed(2)}°N, ${object.lng.toFixed(2)}°E`,
              lat: object.lat, lng: object.lng,
              aiScore: `FRP: ${object.frp || 'N/A'}`,
              waterLevel: `${object.brightness || 'N/A'}K`,
              rainfall: object.acq_date || 'Today',
            });
          }
        },
      }));
    }

    // === HAZARD ALERT CIRCLES ===
    if (alerts.length > 0) {
      const filteredAlerts = alerts.filter(a => {
        if (a.type === 'flood' && !layers.flood) return false;
        if (a.type === 'fire' && !layers.fire) return false;
        if (activeFilter === 'FLOOD' && a.type !== 'flood') return false;
        if (activeFilter === 'FOREST FIRE' && a.type !== 'fire') return false;
        if (activeFilter === 'CRITICAL ONLY' && a.status !== 'critical') return false;
        return true;
      });

      result.push(new ScatterplotLayer({
        id: 'hazard-alerts',
        data: filteredAlerts,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => d.status === 'critical' ? 600 : 400,
        getFillColor: d => d.type === 'fire' ? [239, 68, 68, 80] : [245, 158, 11, 80],
        getLineColor: d => d.type === 'fire' ? [239, 68, 68, 200] : [245, 158, 11, 200],
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        radiusMinPixels: 15,
        radiusMaxPixels: 80,
        onClick: ({ object }) => {
          if (object) setSelectedIncident(object);
        },
      }));
    }

    // === SENSOR NODES ===
    if (layers.nodes && (nodes.length > 0 || (!isSupabaseConfigured && alerts.length > 0))) {
      const nodeData = nodes.length > 0
        ? nodes.map(n => ({ ...n, lat: n.latitude, lng: n.longitude }))
        : alerts;

      result.push(new ScatterplotLayer({
        id: 'sensor-nodes',
        data: nodeData,
        getPosition: d => [d.lng, d.lat],
        getRadius: 300,
        getFillColor: [16, 185, 129, 200],
        getLineColor: [16, 185, 129, 255],
        lineWidthMinPixels: 2,
        stroked: true,
        pickable: true,
        radiusMinPixels: 5,
        radiusMaxPixels: 15,
        onClick: ({ object }) => {
          if (object) {
            setSelectedIncident({
              id: object.id, type: object.node_type || object.type || 'sensor',
              status: object.status || 'online', location: object.name || object.location,
              lat: object.lat, lng: object.lng,
            });
          }
        },
      }));
    }

    // === DISASTER ZONES ===
    if (layers.disasterZones) {
      result.push(new ScatterplotLayer({
        id: 'disaster-zones',
        data: DISASTER_ZONES,
        getPosition: d => [d.lng, d.lat],
        getRadius: d => d.radius,
        getFillColor: d => SEVERITY_RING_COLORS[d.severity] || [245, 158, 11, 30],
        getLineColor: d => [...(SEVERITY_COLORS[d.severity] || [245, 158, 11]), 150],
        lineWidthMinPixels: 2,
        stroked: true,
        filled: true,
        pickable: true,
        radiusMinPixels: 20,
        onClick: ({ object }) => {
          if (object) {
            setSelectedIncident({
              id: object.id, type: object.type, status: object.severity,
              location: object.name, lat: object.lat, lng: object.lng,
              riskPop: 'Zone Active', aiScore: object.severity.toUpperCase(),
              waterLevel: object.description, rainfall: object.type,
            });
          }
        },
      }));
    }

    return result;
  }, [layers, earthquakes, fires, alerts, nodes, activeFilter]);

  // ── ALERT HELPERS ──
  const getAlertColor = (type) => type === 'fire' ? '#ef4444' : '#f59e0b';
  const getAlertIcon = (type) => {
    if (type === 'fire' || type === 'nasaFires') return <Flame size={12} />;
    if (type === 'flood') return <Droplets size={12} />;
    if (type === 'earthquake' || type === 'seismic') return <Activity size={12} />;
    return <Wind size={12} />;
  };

  // ── SPLASH SCREEN ──
  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="h-full bg-black flex flex-col relative font-mono text-white/80">
      {/* ── TOP BAR ── */}
      <div className="p-3 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 flex justify-between items-center z-10 shadow-lg relative">
        <div className="flex items-center gap-4">
          <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Crosshair size={16} className="text-amber-400" />
            INTELLIGENCE MAP
          </h2>
          <div className="hidden md:flex items-center gap-3 text-[10px] text-white/40 font-medium">
            <ZuluClock />
            <span className="text-white/10">|</span>
            <UptimeClock />
            <span className="text-white/10">|</span>
            <span>ENTITIES: <span className="text-emerald-400 font-bold tabular-nums">{totalEntities.toLocaleString()}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-black rounded-lg p-0.5 border border-white/10">
            {['ALL HAZARDS', 'FLOOD', 'FOREST FIRE', 'CRITICAL ONLY'].map(filter => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1.5 text-[10px] font-bold rounded-md transition-colors ${activeFilter === filter
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-white/40 hover:text-white/70'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowLayers(p => !p)}
            title="Toggle layers (L)"
            className={`p-2 rounded-lg transition-colors ${showLayers ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/70'}`}
          >
            <Layers size={16} />
          </button>
          <button
            onClick={() => setShowIntel(p => !p)}
            title="Toggle intel feed (I)"
            className={`p-2 rounded-lg transition-colors ${showIntel ? 'bg-amber-500/20 text-amber-400' : 'text-white/40 hover:text-white/70'}`}
          >
            <Newspaper size={16} />
          </button>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            title="Fullscreen (F)"
            className="p-2 rounded-lg text-white/40 hover:text-white/70 transition-colors"
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>

      {/* ── MAP AREA ── */}
      <div className="flex-1 relative z-0">

        {/* DeckGL + Map */}
        <DeckGL
          viewState={viewState}
          onViewStateChange={({ viewState: vs }) => setViewState(vs)}
          controller={true}
          layers={deckLayers}
          onHover={handleMouseMove}
          getCursor={() => 'crosshair'}
          style={{ position: 'absolute', inset: 0 }}
        >
          <Map
            mapStyle={MAP_STYLE}
            attributionControl={true}
            style={{ width: '100%', height: '100%' }}
          />
        </DeckGL>

        {/* ── LAYER PANEL ── */}
        {showLayers && (
          <LayerPanel
            layers={layers}
            onToggle={handleLayerToggle}
            entityCounts={entityCounts}
            onClose={() => setShowLayers(false)}
          />
        )}

        {/* ── WEATHER HUD ── */}
        {layers.weather && weather && (
          <div className="absolute top-4 right-4 z-[400] bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl w-48 animate-fade-in">
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Cloud size={12} /> WEATHER
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="text-2xl">{weather.weatherCode <= 3 ? '☀️' : weather.weatherCode <= 65 ? '🌧️' : '⛈️'}</div>
              <div>
                <div className="text-lg font-bold text-white tabular-nums">{weather.temperature}°C</div>
                <div className="text-[10px] text-white/50">{weather.description}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center text-[9px] border-t border-white/10 pt-2">
              <div><div className="text-white/30"><Droplets size={10} className="inline" /></div><div className="text-white/70 tabular-nums">{weather.humidity}%</div></div>
              <div><div className="text-white/30"><Wind size={10} className="inline" /></div><div className="text-white/70 tabular-nums">{weather.windSpeed}km/h</div></div>
              <div><div className="text-white/30"><CloudRain size={10} className="inline" /></div><div className="text-white/70 tabular-nums">{weather.precipitation}mm</div></div>
            </div>
          </div>
        )}

        {/* ── INTEL FEED PANEL ── */}
        {showIntel && (
          <IntelFeed
            events={intelEvents}
            visible={showIntel}
            onClose={() => setShowIntel(false)}
            onFlyTo={handleFlyTo}
          />
        )}

        {/* ── INCIDENT DETAIL PANEL ── */}
        {selectedIncident && (
          <div className="absolute top-0 right-0 h-full w-96 bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-[500] flex flex-col animate-slide-in-right">
            <div className={`p-5 flex justify-between items-start border-b border-white/10 ${selectedIncident.status === 'critical' ? 'bg-rose-900/20' : 'bg-orange-900/20'}`}>
              <div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase mb-2 inline-block ${selectedIncident.status === 'critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-orange-500/20 text-orange-400'}`}>
                  {selectedIncident.status} {selectedIncident.type}
                </span>
                <h2 className="text-xl font-bold text-white">{selectedIncident.location}</h2>
                <p className="text-xs text-white/50 mt-1 flex items-center gap-1"><AlertOctagon size={12} /> AI Confidence: {selectedIncident.aiScore || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedIncident(null)} className="text-white/50 hover:text-white bg-white/10 p-1.5 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-6">
              <div>
                <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Current Situation</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black p-3 rounded-lg border border-white/10">
                    <div className="text-white/30 text-xs mb-1 flex items-center gap-1">
                      {getAlertIcon(selectedIncident.type)} {selectedIncident.type === 'earthquake' ? 'Depth' : 'Indicator 1'}
                    </div>
                    <div className="text-lg font-bold text-white">{selectedIncident.waterLevel || 'Critical'}</div>
                  </div>
                  <div className="bg-black p-3 rounded-lg border border-white/10">
                    <div className="text-white/30 text-xs mb-1 flex items-center gap-1">
                      <CloudRain size={12} /> {selectedIncident.type === 'earthquake' ? 'Time' : 'Indicator 2'}
                    </div>
                    <div className="text-lg font-bold text-white">{selectedIncident.rainfall || 'Severe'}</div>
                  </div>
                </div>
              </div>

              {selectedIncident.type === 'earthquake' && selectedIncident.tsunami && (
                <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg flex items-center gap-2">
                  <AlertTriangle size={16} className="text-rose-400" />
                  <span className="text-sm font-bold text-rose-400">⚠️ TSUNAMI WARNING ACTIVE</span>
                </div>
              )}

              {selectedIncident.riskPop && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-lg">
                  <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Users size={14} /> Population Risk
                  </h3>
                  <p className="text-xl font-bold text-white mb-1">{selectedIncident.riskPop} people at risk</p>
                  <p className="text-xs text-white/70">2 schools, 1 hospital in immediate trajectory.</p>
                </div>
              )}

              <div className="bg-white/[0.03] border border-white/10 p-3 rounded-lg">
                <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Coordinates</h3>
                <p className="text-sm text-white/80 tabular-nums">
                  {selectedIncident.lat?.toFixed(4)}°N, {selectedIncident.lng?.toFixed(4)}°E
                </p>
              </div>

              <div className="pt-2 space-y-3">
                <button className="w-full bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 rounded-lg shadow-lg shadow-amber-500/20 transition-colors">
                  View Spread Simulation
                </button>
                <button className="w-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/15 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <ShieldPlus size={18} /> Send Community Alert
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── HUD STATUS BAR ── */}
      <HudStatusBar
        entityCount={totalEntities}
        backendStatus={backendStatus}
        mouseCoords={mouseCoords}
        locationLabel={locationLabel}
      />

      {/* ── KEYBOARD SHORTCUTS HINT ── */}
      <div className="absolute bottom-10 right-4 z-[300] text-[9px] text-white/20 font-mono space-x-3 hidden lg:block">
        <span>[F] Fullscreen</span>
        <span>[L] Layers</span>
        <span>[I] Intel</span>
        <span>[R] Reset View</span>
        <span>[Esc] Close</span>
      </div>
    </div>
  );
}