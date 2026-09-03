import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Map, { Marker } from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Play, Pause, Navigation2, Users, ShieldAlert, Navigation, Flame, Droplets, MapPin, Loader2, Maximize, Activity } from 'lucide-react';
import { generateDynamicSimulation } from '../lib/simulationEngine';
import { checkWaterProximity, fetchRoads } from '../lib/overpassApi';
import { supabase } from '../lib/supabaseClient';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZHVtbXl1c2VyIiwiYSI6ImNsdW1teXRva2VuMTIzIn0.dummy';

export default function Simulation() {
  const [viewState, setViewState] = useState({
    longitude: 88.435, 
    latitude: 22.632,
    zoom: 12,
    pitch: 45,
    bearing: 0
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [timeStep, setTimeStep] = useState(0);
  const [simulationData, setSimulationData] = useState(null);
  
  const [hazardCenter, setHazardCenter] = useState(null);
  const [hazardType, setHazardType] = useState('fire');
  const [simulationRadius, setSimulationRadius] = useState(5); // km
  const [isWaterNearby, setIsWaterNearby] = useState(false);
  
  const [showResponsePlan, setShowResponsePlan] = useState(false);
  const [roadNetwork, setRoadNetwork] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initial load: Fetch the most recent active alert
  useEffect(() => {
    const fetchLatestAlert = async () => {
      try {
        const { data, error } = await supabase
          .from('alerts')
          .select('*')
          .eq('resolved', false)
          .order('created_at', { ascending: false })
          .limit(1);

        if (data && data.length > 0 && data[0].latitude && data[0].longitude) {
          console.log("Found latest alert:", data[0]);
          handleSetHazardOrigin(data[0].longitude, data[0].latitude, data[0].type || 'fire');
        }
      } catch (err) {
        console.log("No latest alert found or Supabase not fully connected yet.");
      }
    };
    fetchLatestAlert();
  }, []);

  // Listen to Supabase for live ESP32 alerts
  useEffect(() => {
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' }, 
        (payload) => {
          console.log("Live Alert Received from ESP32:", payload);
          if (payload.new && payload.new.latitude && payload.new.longitude) {
            handleSetHazardOrigin(payload.new.longitude, payload.new.latitude, payload.new.type);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSetHazardOrigin = async (lon, lat, forceType = null) => {
    setIsGenerating(true);
    setHazardCenter({ lon, lat });
    
    setViewState(prev => ({
      ...prev,
      longitude: lon,
      latitude: lat,
      transitionDuration: 1500 // cinematic fly-to
    }));

    // Fetch live OSM data
    const waterNearby = await checkWaterProximity(lat, lon);
    setIsWaterNearby(waterNearby);
    
    const typeToUse = forceType || (waterNearby ? 'flood' : 'fire');
    setHazardType(typeToUse);

    const roads = await fetchRoads(lat, lon, simulationRadius * 1000);
    setRoadNetwork(roads);

    const simData = generateDynamicSimulation(lon, lat, typeToUse, simulationRadius);
    setSimulationData(simData);
    setTimeStep(0);
    setIsPlaying(true);
    setIsGenerating(false);
  };

  const onMapClick = (info) => {
    if (info.coordinate) {
      handleSetHazardOrigin(info.coordinate[0], info.coordinate[1]);
    }
  };

  // Re-generate if radius or hazard type changes (without moving camera)
  useEffect(() => {
    if (hazardCenter && !isGenerating) {
      const simData = generateDynamicSimulation(hazardCenter.lon, hazardCenter.lat, hazardType, simulationRadius);
      setSimulationData(simData);
      setTimeStep(0);
    }
  }, [hazardType, simulationRadius, hazardCenter]);

  const maxTime = simulationData ? Math.max(...simulationData.timesteps.map(t => t.time)) : 10;

  useEffect(() => {
    let interval;
    if (isPlaying && simulationData) {
      interval = setInterval(() => {
        setTimeStep(prev => {
          if (prev >= maxTime) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isPlaying, maxTime, simulationData]);

  const currentData = useMemo(() => {
    if (!simulationData) return null;
    return simulationData.timesteps.find(t => t.time === timeStep) || simulationData.timesteps[0];
  }, [simulationData, timeStep]);

  const layers = useMemo(() => {
    if (!currentData || !hazardCenter) return [];

    const layersArr = [];

    // Organic Polygon Layer (Production Grade)
    layersArr.push(
      new GeoJsonLayer({
        id: 'hazard-layer',
        data: currentData.geojson,
        filled: true,
        stroked: false,
        extruded: false,
        getFillColor: f => {
          const confidence = f.properties.confidence;
          const ratio = Math.max(0, Math.min(1, (confidence - 10) / 90)); 
          
          if (hazardType === 'flood') {
            const r = Math.round(11 + ratio * (125 - 11));
            const g = Math.round(61 + ratio * (211 - 61));
            const b = Math.round(99 + ratio * (232 - 99));
            return [r, g, b, 150 + (ratio * 105)];
          } else if (hazardType === 'earthquake') {
            const isNew = f.properties.isNew;
            const r = Math.round(70 + ratio * (255 - 70));
            const g = Math.round(0 + ratio * (150 - 0));
            const b = Math.round(70 + ratio * (255 - 70));
            return [r, g, b, isNew ? 255 : 100 + (ratio * 100)];
          } else {
            const isNew = f.properties.isNew;
            const r = Math.round(150 + ratio * (242 - 150)); 
            const g = Math.round(30 + ratio * (153 - 30));  
            const b = Math.round(30 + ratio * (74 - 30));    
            return [r, g, b, isNew ? 255 : 150 + (ratio * 105)];
          }
        },
        updateTriggers: {
          getFillColor: [timeStep, hazardType]
        },
        transitions: {
          getFillColor: 500,
          geometry: 500
        }
      })
    );

    if (showResponsePlan && roadNetwork) {
      layersArr.push(
        new GeoJsonLayer({
          id: 'evacuation-routes',
          data: roadNetwork,
          stroked: true,
          getLineColor: [16, 185, 129, 255], // Glowing green
          getLineWidth: 20,
          lineWidthMinPixels: 4,
          opacity: 1
        })
      );

      layersArr.push(
        new ScatterplotLayer({
          id: 'staging-area',
          data: [{ position: [hazardCenter.lon, hazardCenter.lat + (simulationRadius * 0.005)], name: "Safe Staging Point" }],
          getPosition: d => d.position,
          getFillColor: [59, 130, 246, 200],
          getRadius: 200,
          stroked: true,
          getLineColor: [255, 255, 255],
          lineWidthMinPixels: 3
        })
      );
    }
    
    return layersArr;
  }, [currentData, showResponsePlan, roadNetwork, hazardCenter, hazardType, timeStep, simulationRadius]);

  return (
    <div className="h-full bg-black text-white relative flex flex-col font-mono overflow-hidden">
      
      <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide drop-shadow-md">Live Hazard Simulation</h1>
          <p className="text-sm text-white/80 drop-shadow-md mt-1 flex items-center gap-2">
             <MapPin size={14} className="text-rose-400" />
             {hazardCenter ? `Live Feed: [${hazardCenter.lat.toFixed(4)}, ${hazardCenter.lon.toFixed(4)}] • Click map for custom simulation` : 'Click anywhere on the map to trigger an artificial simulation'}
          </p>
        </div>

        <div className="flex gap-4 pointer-events-auto">
          {isGenerating && (
             <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg flex items-center gap-3 mr-4">
                 <Loader2 size={18} className="animate-spin text-blue-400" />
                 <span className="text-sm font-bold text-white/70">Generating live simulation...</span>
             </div>
          )}

          {hazardCenter && !isGenerating && (
            <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-lg flex flex-col gap-3 justify-center mr-4">
               {/* Radius Slider */}
               <div className="flex items-center gap-2 px-2">
                 <Maximize size={14} className="text-white/50" />
                 <span className="text-xs font-bold text-white/70 whitespace-nowrap">Radius: {simulationRadius}km</span>
                 <input 
                   type="range" 
                   min={2} 
                   max={15} 
                   value={simulationRadius} 
                   onChange={(e) => setSimulationRadius(parseInt(e.target.value))}
                   className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
                 />
               </div>
               
               <div className="flex gap-2">
                 {isWaterNearby && (
                   <button 
                      onClick={() => setHazardType('flood')}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${hazardType === 'flood' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'text-white/50 hover:bg-white/5'}`}
                   >
                      <Droplets size={16} /> Flood
                   </button>
                 )}
                 <button 
                    onClick={() => setHazardType('fire')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${hazardType === 'fire' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'text-white/50 hover:bg-white/5'}`}
                 >
                    <Flame size={16} /> Fire
                 </button>
                 <button 
                    onClick={() => setHazardType('earthquake')}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors ${hazardType === 'earthquake' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'text-white/50 hover:bg-white/5'}`}
                 >
                    <Activity size={16} /> Quake
                 </button>
               </div>
            </div>
          )}

          {currentData && (
            <>
              <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg min-w-[150px]">
                <div className="text-xs text-white/50 mb-1 flex items-center gap-2"><ShieldAlert size={14}/> Confidence</div>
                <div className="text-2xl font-bold text-cyan-400">{currentData.confidence}%</div>
                <div className="text-[10px] text-white/40 mt-1">Model certainty</div>
              </div>
              <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-lg min-w-[150px]">
                <div className="text-xs text-white/50 mb-1 flex items-center gap-2"><Users size={14}/> Affected Pop.</div>
                <div className="text-2xl font-bold text-rose-400">~{currentData.population_affected.toLocaleString()}</div>
                <div className="text-[10px] text-white/40 mt-1">In projected path</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 relative cursor-crosshair">
        <DeckGL
          viewState={viewState}
          onViewStateChange={e => setViewState(e.viewState)}
          controller={true}
          layers={layers}
          onClick={onMapClick}
          getCursor={() => 'crosshair'}
          getTooltip={({object}) => object && (object.properties ? `Confidence: ${object.properties.confidence}%` : object.name)}
        >
          <Map
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            {hazardCenter && (
              <Marker longitude={hazardCenter.lon} latitude={hazardCenter.lat} anchor="bottom">
                <MapPin size={36} className="text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)] fill-rose-500/20 animate-bounce" />
              </Marker>
            )}
          </Map>
        </DeckGL>
      </div>

      {simulationData && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-[#0a0a0a]/90 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-6 z-20">
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors flex-shrink-0 shadow-lg shadow-blue-900/50"
          >
            {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current translate-x-[1px]" />}
          </button>

          <div className="flex-1 flex flex-col gap-2">
            <div className="flex justify-between text-xs font-bold text-white/60">
              <span>T+0hr (Detection)</span>
              <span className="text-white">T+{timeStep}hr Projection</span>
              <span>T+{maxTime}hr</span>
            </div>
            <input 
              type="range" 
              min={0} 
              max={maxTime} 
              value={timeStep} 
              onChange={(e) => {
                setTimeStep(parseInt(e.target.value));
                setIsPlaying(false);
              }}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="w-px h-10 bg-white/10 mx-2"></div>

          <button
            onClick={() => setShowResponsePlan(!showResponsePlan)}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${
              showResponsePlan 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Navigation size={16} />
            Response Plan
          </button>

        </div>
      )}
    </div>
  );
}