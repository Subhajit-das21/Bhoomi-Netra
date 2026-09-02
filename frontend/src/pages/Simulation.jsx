import React, { useState, useEffect, useMemo } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { Play, Pause, Navigation2, Users, ShieldAlert, Navigation, Flame, Droplets } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiZHVtbXl1c2VyIiwiYSI6ImNsdW1teXRva2VuMTIzIn0.dummy';

const INITIAL_VIEW_STATE = {
  longitude: 88.435, // Rajarhat, Kolkata
  latitude: 22.632,
  zoom: 12,
  pitch: 45,
  bearing: 0
};

export default function Simulation() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeStep, setTimeStep] = useState(0);
  const [simulationData, setSimulationData] = useState(null);
  const [showResponsePlan, setShowResponsePlan] = useState(false);
  const [hazardType, setHazardType] = useState('flood'); // 'flood' or 'fire'

  useEffect(() => {
    fetch(`/${hazardType}_sim.json`)
      .then(res => res.json())
      .then(data => {
        setSimulationData(data);
        setTimeStep(0); // reset timestep on change
      })
      .catch(err => console.error("Error loading simulation data:", err));
  }, [hazardType]);

  const maxTime = simulationData ? Math.max(...simulationData.timesteps.map(t => t.time)) : 10;

  useEffect(() => {
    let interval;
    if (isPlaying) {
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
  }, [isPlaying, maxTime]);

  const currentData = useMemo(() => {
    if (!simulationData) return null;
    return simulationData.timesteps.find(t => t.time === timeStep) || simulationData.timesteps[0];
  }, [simulationData, timeStep]);

  const layers = useMemo(() => {
    if (!currentData) return [];

    const layersArr = [];

    // 1. Hazard Polygon Layer
    layersArr.push(
      new GeoJsonLayer({
        id: 'hazard-layer',
        data: currentData.geojson,
        filled: true,
        extruded: false,
        getFillColor: f => {
          const confidence = f.properties.confidence;
          const ratio = (confidence - 20) / 75; 
          
          if (hazardType === 'flood') {
            // Flood: pale cyan to deep navy-blue
            const r = Math.round(125 - ratio * (125 - 11));
            const g = Math.round(211 - ratio * (211 - 61));
            const b = Math.round(232 - ratio * (232 - 99));
            return [r, g, b, 180 + (ratio * 75)];
          } else {
            // Fire: amber/orange to deep red
            const isNew = f.properties.isNew;
            const r = Math.round(242 - ratio * (242 - 185)); // 242 -> 185
            const g = Math.round(153 - ratio * (153 - 28));  // 153 -> 28
            const b = Math.round(74 - ratio * (74 - 28));    // 74 -> 28
            // Add a slight opacity pulse if it's the leading edge (isNew)
            const alpha = isNew ? 255 : 180 + (ratio * 75);
            return [r, g, b, alpha];
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

    // 2. Response Plan Overlay
    if (showResponsePlan) {
      const center = simulationData.center;
      const corridorPath = {
        path: [
          [center[0] - 0.05, center[1] + 0.05],
          [center[0] - 0.02, center[1] + 0.03],
          [center[0], center[1] + 0.04]
        ],
        name: "Evacuation Corridor A"
      };

      layersArr.push(
        new PathLayer({
          id: 'safe-corridor',
          data: [corridorPath],
          getPath: d => d.path,
          getColor: [16, 185, 129],
          getWidth: 15,
          widthMinPixels: 4
        })
      );

      layersArr.push(
        new ScatterplotLayer({
          id: 'staging-area',
          data: [{ position: [center[0], center[1] + 0.04], name: "Staging Point Alpha" }],
          getPosition: d => d.position,
          getFillColor: [59, 130, 246],
          getRadius: 150,
          stroked: true,
          getLineColor: [255, 255, 255],
          lineWidthMinPixels: 2
        })
      );
    }

    return layersArr;
  }, [currentData, showResponsePlan, simulationData, timeStep, hazardType]);

  return (
    <div className="h-full bg-black text-white relative flex flex-col font-mono overflow-hidden">
      
      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 pointer-events-none flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-wide drop-shadow-md">Hazard Prediction & Rescue Plan</h1>
          <p className="text-sm text-white/80 drop-shadow-md">Rajarhat, Kolkata - {hazardType === 'flood' ? 'Flood & Spread Forecast' : 'Fire Spread Forecast'}</p>
        </div>

        {/* HUD Stats & Controls */}
        <div className="flex gap-4 pointer-events-auto">
          {/* Hazard Toggle */}
          <div className="bg-[#0a0a0a]/80 backdrop-blur-md border border-white/10 rounded-xl p-2 shadow-lg flex flex-col gap-2 justify-center mr-4">
             <button 
                onClick={() => setHazardType('flood')}
                className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${hazardType === 'flood' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'text-white/50 hover:bg-white/5'}`}
             >
                <Droplets size={16} /> Flood
             </button>
             <button 
                onClick={() => setHazardType('fire')}
                className={`px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors ${hazardType === 'fire' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'text-white/50 hover:bg-white/5'}`}
             >
                <Flame size={16} /> Fire
             </button>
          </div>

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

      {/* Main Map Area */}
      <div className="flex-1 relative">
        <DeckGL
          initialViewState={INITIAL_VIEW_STATE}
          controller={true}
          layers={layers}
          getTooltip={({object}) => object && (object.properties ? `Confidence: ${object.properties.confidence}%` : object.name)}
        >
          <Map
            mapStyle="mapbox://styles/mapbox/dark-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
          />
        </DeckGL>
      </div>

      {/* Bottom Control Bar - Scrubber & Actions */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-[#0a0a0a]/90 backdrop-blur-lg border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-6 z-20">
        
        {/* Play/Pause */}
        <button 
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors flex-shrink-0 shadow-lg shadow-blue-900/50"
        >
          {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current translate-x-[1px]" />}
        </button>

        {/* Scrubber */}
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

        {/* Response Plan Toggle */}
        <button
          onClick={() => setShowResponsePlan(!showResponsePlan)}
          className={`px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors ${
            showResponsePlan 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
              : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Navigation size={16} />
          Response Plan
        </button>

      </div>

    </div>
  );
}