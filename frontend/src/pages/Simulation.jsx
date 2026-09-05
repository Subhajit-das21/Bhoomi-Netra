import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map from 'react-map-gl/mapbox';
import DeckGL from '@deck.gl/react';
import {
  Activity, Droplets, Flame, Loader2, Pause, Play, RotateCcw,
} from 'lucide-react';
import { HAZARD_META, defaultParams, formatClock, runSimulation } from '../lib/simulationEngine';
import { buildLayers, smokeCanvas, washCanvas } from '../lib/sim/layers';
import { dressBasemap, hasFootprints, setStudyMask } from '../lib/sim/basemap';
import { RAMPS } from '../lib/sim/raster';
import ScenarioControls from '../components/sim/ScenarioControls';
import ImpactCharts from '../components/sim/ImpactCharts';
import EventLog from '../components/sim/EventLog';
import {
  Evacuation, Exposure, Facilities, HazardMetrics, Headline, Provenance,
} from '../components/sim/ReadoutPanels';
import { Panel } from '../components/panels';
import { supabase } from '../lib/supabaseClient';

/**
 * The simulation workbench.
 *
 * Pick a point, and the page harvests what the basemap knows about that place —
 * footprints, carriageways, water, facilities — runs a hazard model over it, and
 * scores every timestep against the structures and the people inside them.
 *
 * Two things about the camera are load-bearing rather than cosmetic. Mapbox only
 * ships the building source layer at higher zooms, so the view is clamped in
 * close enough that footprints exist to be read; and the model runs again on the
 * next idle, once the tiles that cover the study square have actually landed.
 */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
  || 'pk.eyJ1IjoiZHVtbXl1c2VyIiwiYSI6ImNsdW1teXRva2VuMTIzIn0.dummy';
const HAS_TOKEN = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);

/** Rajarhat — where the sensor network actually is. */
const HOME = { longitude: 88.435, latitude: 22.632 };

/**
 * Mapbox counts zoom against 512 px tiles, so one zoom level is half the ground
 * resolution of the 256 px convention. Fit the study square to the viewport, but
 * never pull back past 15.2: the basemap only carries the building source layer
 * in useful numbers from about there, and below it the harvest comes back with a
 * hundred footprints for a city of thousands. At 15.2 a 2 km square still fits a
 * full-width pane, which is the default study area.
 */
const MPP_Z0 = 78271.516;
function zoomForSpan(lat, spanM, px) {
  const ground = MPP_Z0 * Math.cos((lat * Math.PI) / 180);
  const z = Math.log2((ground * Math.max(320, px)) / spanM);
  return Math.min(17.4, Math.max(15.2, z));
}

const HAZARDS = [
  { key: 'fire', label: 'Fire', Icon: Flame },
  { key: 'flood', label: 'Flood', Icon: Droplets },
  { key: 'earthquake', label: 'Quake', Icon: Activity },
];

const TOGGLES = [
  { key: 'wash', label: 'Hazard field' },
  { key: 'contours', label: 'Isolines' },
  { key: 'water', label: 'Water bodies' },
  { key: 'buildings', label: 'Structures' },
  { key: 'roads', label: 'Roads' },
  { key: 'columns', label: 'Active cells' },
  { key: 'smoke', label: 'Smoke plume', only: 'fire' },
  { key: 'wavefront', label: 'P and S fronts', only: 'earthquake' },
  { key: 'corridors', label: 'Ways out' },
  { key: 'facilities', label: 'Facilities' },
];

const DEFAULT_SHOW = {
  wash: true,
  contours: true,
  water: true,
  buildings: true,
  roads: true,
  columns: true,
  smoke: true,
  wavefront: true,
  corridors: true,
  facilities: true,
};

/** What the ground wash means, in the units of the hazard it belongs to. */
const LEGEND = {
  fire: { title: 'Fireline intensity', low: 'smouldering', high: 'crown fire' },
  flood: { title: 'Water depth', low: 'sheet flow', high: 'over a metre' },
  earthquake: { title: 'Shaking, MMI', low: 'felt', high: 'destructive' },
};

const SPEEDS = [
  { label: '0.5x', ms: 820 },
  { label: '1x', ms: 420 },
  { label: '2x', ms: 210 },
  { label: '4x', ms: 105 },
];

const TOOLTIP_STYLE = {
  background: 'rgba(10,10,12,0.94)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '11px',
  lineHeight: '1.45',
  padding: '7px 9px',
  maxWidth: '260px',
};

const DAMAGE_WORD = ['undamaged', 'slight damage', 'moderate damage', 'beyond repair', 'destroyed'];
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const row = (k, v) => `<div style="opacity:.55">${esc(k)}</div><div>${esc(v)}</div>`;

/**
 * Hover text is built as HTML rather than held in React state on purpose —
 * pushing every mousemove through a re-render stutters a 128x128 field.
 */
function tooltipFor(info, sim, frame) {
  const { object, layer, index } = info;
  if (!object || !sim) return null;
  const id = layer?.id;
  let html = null;
  if (id === 'sim-buildings') {
    const ds = frame.exposure.buildingState[index] || 0;
    html = [
      `<div style="font-weight:600">${esc(object.name || object.clsLabel)}</div>`,
      '<div style="display:grid;grid-template-columns:auto 1fr;gap:1px 8px;margin-top:4px">',
      row('State', DAMAGE_WORD[ds]),
      row('Construction', object.clsLabel),
      row('Footprint', `${Math.round(object.areaM2)} m², ${object.levels} floors`),
      row('People inside', object.occupancy),
      object.critical ? row('Note', 'critical facility') : '',
      '</div>',
    ].join('');
  } else if (id === 'sim-roads') {
    const cut = frame.exposure.severedRoads[index];
    html = [
      `<div style="font-weight:600">${esc(object.name || object.cls.replace(/_/g, ' '))}</div>`,
      '<div style="display:grid;grid-template-columns:auto 1fr;gap:1px 8px;margin-top:4px">',
      row('Status', cut ? 'impassable at this step' : 'open'),
      row('Length', `${Math.round(object.lengthM)} m`),
      '</div>',
    ].join('');
  } else if (id === 'sim-facilities') {
    html = [
      `<div style="font-weight:600">${esc(object.name || object.kindLabel)}</div>`,
      '<div style="display:grid;grid-template-columns:auto 1fr;gap:1px 8px;margin-top:4px">',
      row('Type', object.kindLabel),
      row('Now', object.detail),
      '</div>',
    ].join('');
  }
  return html ? { html, style: TOOLTIP_STYLE } : null;
}

function HazardPicker({ hazard, onPick, disabled }) {
  return (
    <div className="flex gap-1">
      {HAZARDS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          onClick={() => onPick(key)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] transition-colors disabled:opacity-40 ${
            hazard === key
              ? 'border-white/35 bg-white/15 text-white'
              : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/10 hover:text-white/85'
          }`}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

function LayerToggles({ hazard, show, onToggle }) {
  const rows = TOGGLES.filter((t) => !t.only || t.only === hazard);
  return (
    <Panel title="Drawn on the map" right={`${rows.filter((t) => show[t.key]).length} of ${rows.length}`}>
      <div className="grid grid-cols-2 gap-x-3">
        {rows.map((t) => (
          <label key={t.key} className="flex cursor-pointer items-center gap-2 py-[3px] text-[11px] text-white/70">
            <input
              type="checkbox"
              checked={Boolean(show[t.key])}
              onChange={() => onToggle(t.key)}
              className="h-3 w-3 accent-white/80"
            />
            <span className="truncate">{t.label}</span>
          </label>
        ))}
      </div>
    </Panel>
  );
}

/** The ground wash, with both ends named so the colour is readable as a value. */
function Legend({ hazard }) {
  const spec = LEGEND[hazard] || LEGEND.fire;
  const ramp = RAMPS[hazard] || RAMPS.fire;
  const stops = Array.from({ length: 12 }, (_, i) => {
    const [r, g, b] = ramp(i / 11);
    return `rgb(${r},${g},${b}) ${(i / 11) * 100}%`;
  }).join(', ');
  return (
    <div className="pointer-events-none absolute bottom-24 left-3 w-44 rounded-lg border border-white/10 bg-[#0a0a0a]/85 p-2 backdrop-blur-md">
      <div className="pb-1 text-[10px] text-white/55">{spec.title}</div>
      <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${stops})` }} />
      <div className="flex justify-between pt-1 text-[9px] text-white/40">
        <span>{spec.low}</span>
        <span>{spec.high}</span>
      </div>
    </div>
  );
}

function PlaybackBar({
  sim, tIndex, onSeek, playing, onPlay, speedIndex, onSpeed, clock, event,
}) {
  const last = sim.frames.length - 1;
  const atEnd = tIndex >= last;
  return (
    <div className="absolute inset-x-3 bottom-3 rounded-xl border border-white/10 bg-[#0a0a0a]/92 p-3 backdrop-blur-lg">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onPlay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
          title={atEnd ? 'Play from the start' : playing ? 'Pause' : 'Play'}
        >
          {atEnd ? <RotateCcw size={15} /> : playing ? <Pause size={15} /> : <Play size={15} className="translate-x-px" />}
        </button>
        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={last}
            step={1}
            value={tIndex}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white"
          />
          <div className="flex items-baseline justify-between pt-1 text-[10px] text-white/40">
            <span>T+0</span>
            <span className="min-w-0 truncate px-2 text-white/70">{event || 'nothing logged yet'}</span>
            <span>{formatClock(sim.hazard, sim.frames[last])}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold tabular-nums text-white">{clock}</div>
          <div className="text-[10px] text-white/40">step {tIndex + 1} of {last + 1}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => onSpeed(i)}
              className={`rounded px-2 py-1 text-[10px] tabular-nums ${
                i === speedIndex ? 'bg-white/20 text-white' : 'text-white/45 hover:bg-white/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Simulation() {
  const [view, setView] = useState({ ...HOME, zoom: 15, pitch: 52, bearing: -14 });
  const [origin, setOrigin] = useState(null);
  const [originNote, setOriginNote] = useState('Click the map to put an incident somewhere.');
  const [hazard, setHazard] = useState('fire');
  const [params, setParams] = useState(() => defaultParams('fire'));
  // 0.75 km of radius is a 1.5 km square, which is what fits on screen at the
  // zoom the basemap needs — and it puts 11.7 m cells under a 128² grid.
  const [radiusKm, setRadiusKm] = useState(0.75);
  const [gridSize, setGridSize] = useState(128);

  const [sim, setSim] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [tIndex, setTIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(1);
  const [show, setShow] = useState(DEFAULT_SHOW);
  const [runToken, setRunToken] = useState(0);

  const mapRef = useRef(null);
  const mapBoxRef = useRef(null);
  const lastOriginRef = useRef(null);
  const lastHazardRef = useRef(null);
  const pendingHarvestRef = useRef(false);
  const harvestTriesRef = useRef(0);
  const dressedRef = useRef(false);
  const maskRef = useRef(null);

  /** Move the camera to frame the study square, close enough that tiles carry buildings. */
  const frameStudyArea = useCallback((lon, lat, km) => {
    const px = mapBoxRef.current?.clientWidth || 900;
    setView((v) => ({
      ...v,
      longitude: lon,
      latitude: lat,
      zoom: zoomForSpan(lat, km * 2000, px * 0.82),
      pitch: v.pitch < 20 ? 52 : v.pitch,
      transitionDuration: 1200,
    }));
  }, []);

  const placeIncident = useCallback((lon, lat, note, forceHazard = null) => {
    harvestTriesRef.current = 0;
    pendingHarvestRef.current = true;
    if (forceHazard && HAZARD_META[forceHazard]) {
      setHazard(forceHazard);
      setParams(defaultParams(forceHazard));
    }
    setOriginNote(note);
    setOrigin({ lon, lat });
    frameStudyArea(lon, lat, radiusKm);
  }, [frameStudyArea, radiusKm]);

  const placeRef = useRef(placeIncident);
  useEffect(() => { placeRef.current = placeIncident; }, [placeIncident]);

  // Alerts carry no coordinates of their own — they point at the node that
  // raised them, and the node knows where it is. Reading alert.latitude, as this
  // page used to, silently found nothing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from('alerts')
        .select('*, sensor_nodes(name, latitude, longitude)')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled || qErr) return;
      const a = data?.[0];
      const node = a?.sensor_nodes;
      if (!node?.latitude || !node?.longitude) return;
      placeRef.current(
        node.longitude, node.latitude,
        `Open ${a.hazard_type} alert at ${node.name || 'an unnamed node'}`, a.hazard_type,
      );
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('sim-alert-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alerts' },
        async (payload) => {
          const a = payload.new;
          if (!a?.node_id) return;
          const { data } = await supabase
            .from('sensor_nodes')
            .select('name, latitude, longitude')
            .eq('id', a.node_id)
            .maybeSingle();
          if (!data?.latitude || !data?.longitude) return;
          placeRef.current(
            data.longitude, data.latitude,
            `Live ${a.hazard_type} alert at ${data.name || 'an unnamed node'}`, a.hazard_type,
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (origin) frameStudyArea(origin.lon, origin.lat, radiusKm);
  }, [origin, radiusKm, frameStudyArea]);

  // The model itself. Debounced, because dragging a slider would otherwise queue
  // one full run per pixel, and each run is a few hundred milliseconds of work on
  // the main thread. The run is then handed to a second timer so the spinner gets
  // a paint in before the thread is taken away from it.
  useEffect(() => {
    if (!origin) return undefined;
    let cancelled = false;
    let work = null;
    let retry = null;
    const run = () => {
      // A new place or a different hazard is a new event: play it from the top.
      // A parameter change is not — keeping the timestep is what lets you drag a
      // slider and watch one moment answer differently.
      const restart = lastOriginRef.current !== origin || lastHazardRef.current !== hazard;
      let next = null;
      try {
        next = runSimulation({
          map: mapRef.current?.getMap?.() || null,
          lon: origin.lon,
          lat: origin.lat,
          hazard,
          radiusKm,
          gridSize,
          params,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'The model stopped with an error.');
          setRunning(false);
        }
        return;
      }
      if (cancelled) return;
      lastOriginRef.current = origin;
      lastHazardRef.current = hazard;
      setError(null);
      setSim(next);
      setTIndex((t) => (restart ? 0 : Math.min(t, next.frames.length - 1)));
      if (restart) setPlaying(true);
      setRunning(false);
      // Footprints only exist in tiles the basemap has actually sent. If this run
      // had to invent a town, ask for another go — the map fires idle when the
      // tiles land, and a timer covers the case where it has already gone quiet
      // and no further idle is ever coming.
      if (next.provenance.source !== 'basemap' && harvestTriesRef.current < 6) {
        pendingHarvestRef.current = true;
        retry = setTimeout(() => {
          if (cancelled || !pendingHarvestRef.current) return;
          pendingHarvestRef.current = false;
          harvestTriesRef.current += 1;
          setRunToken((t) => t + 1);
        }, 900);
      }
    };
    const timer = setTimeout(() => {
      if (cancelled) return;
      setRunning(true);
      work = setTimeout(run, 24);
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (work) clearTimeout(work);
      if (retry) clearTimeout(retry);
    };
  }, [origin, hazard, params, radiusKm, gridSize, runToken]);

  useEffect(() => {
    if (!playing || !sim) return undefined;
    const id = setInterval(() => {
      setTIndex((t) => {
        if (t >= sim.frames.length - 1) {
          setPlaying(false);
          // Come to rest on the worst step, not the last one. For a fire or an
          // earthquake they are the same frame; a flood has drained by the end.
          return sim.peakIndex ?? t;
        }
        return t + 1;
      });
    }, SPEEDS[speedIndex].ms);
    return () => clearInterval(id);
  }, [playing, sim, speedIndex]);

  // The style has to be up before we can restyle it, and `reuseMaps` means a
  // remounted page can inherit a map that loaded long ago and will not fire
  // `load` again — so the idle handler retries the dressing until it takes.
  const onMapLoad = useCallback(() => {
    dressedRef.current = dressBasemap(mapRef.current?.getMap?.());
  }, []);

  const onMapIdle = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!dressedRef.current) {
      dressedRef.current = dressBasemap(map);
      if (dressedRef.current && maskRef.current) setStudyMask(map, maskRef.current);
    }
    if (!pendingHarvestRef.current) return;
    // Idle fires while the tiles are still arriving, and a re-run that finds the
    // same empty source layer has spent a try for nothing. Wait until the map can
    // actually answer with footprints, and keep the request armed until it can.
    if (!hasFootprints(map)) return;
    pendingHarvestRef.current = false;
    harvestTriesRef.current += 1;
    setRunToken((t) => t + 1);
  }, []);

  const onDeckClick = useCallback((info) => {
    if (!info?.coordinate) return;
    placeRef.current(info.coordinate[0], info.coordinate[1], 'Incident placed by hand on the map.');
  }, []);

  const pickHazard = useCallback((key) => {
    setHazard(key);
    setParams(defaultParams(key));
  }, []);

  const toggle = useCallback((key) => {
    setShow((s) => ({ ...s, [key]: !s[key] }));
  }, []);

  const frame = sim ? sim.frames[Math.min(tIndex, sim.frames.length - 1)] : null;

  // Inside the square the model draws the buildings; outside, the basemap does.
  useEffect(() => {
    maskRef.current = sim ? sim.grid.bounds : null;
    setStudyMask(mapRef.current?.getMap?.(), maskRef.current);
  }, [sim]);

  const plan = useMemo(() => (sim ? sim.evacuationAt(tIndex) : null), [sim, tIndex]);
  const wash = useMemo(
    () => (sim && frame && show.wash ? washCanvas(sim, frame) : null),
    [sim, frame, show.wash],
  );
  const smoke = useMemo(
    () => (sim && frame && show.smoke && sim.hazard === 'fire' ? smokeCanvas(sim, frame) : null),
    [sim, frame, show.smoke],
  );
  const layers = useMemo(
    () => (sim && frame ? buildLayers({ sim, frame, tIndex, plan, show, wash, smoke }) : []),
    [sim, frame, tIndex, plan, show, wash, smoke],
  );
  const eventNow = useMemo(() => {
    if (!sim) return null;
    const passed = sim.eventLog.filter((e) => e.t <= tIndex);
    const e = passed[passed.length - 1];
    return e ? `${e.clock} — ${e.text}` : null;
  }, [sim, tIndex]);
  const clock = sim && frame ? formatClock(sim.hazard, frame) : '—';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black font-mono text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-2.5">
        <div className="min-w-0">
          <h1 className="text-[15px] font-semibold text-white">Hazard simulation</h1>
          <p className="truncate text-[11px] text-white/45">
            {origin
              ? `${originNote} ${origin.lat.toFixed(4)}, ${origin.lon.toFixed(4)}`
              : originNote}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {running && (
            <span className="flex items-center gap-1.5 text-[11px] text-white/60">
              <Loader2 size={13} className="animate-spin" />
              running the model
            </span>
          )}
          {!running && sim && (
            <span className="text-[11px] text-white/45">
              {sim.provenance.counts.buildings} footprints, {sim.provenance.counts.roads} road lines,
              {' '}{sim.runtimeMs} ms
            </span>
          )}
          <HazardPicker hazard={hazard} onPick={pickHazard} disabled={running} />
        </div>
      </header>

      {(!HAS_TOKEN || error) && (
        <div className="shrink-0 border-b border-white/10 bg-white/[0.04] px-4 py-1.5 text-[11px] text-white/70">
          {error || 'VITE_MAPBOX_TOKEN is not set, so the basemap will not load and no real footprints can be read. The model still runs on an invented town.'}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="w-[290px] shrink-0 space-y-3 overflow-y-auto border-r border-white/10 p-3">
          <ScenarioControls
            hazard={hazard}
            params={params}
            onParam={(key, value) => setParams((p) => ({ ...p, [key]: value }))}
            radiusKm={radiusKm}
            onRadius={setRadiusKm}
            gridSize={gridSize}
            onGridSize={setGridSize}
          />
          <LayerToggles hazard={hazard} show={show} onToggle={toggle} />
          {sim && <Provenance sim={sim} />}
        </aside>

        <div ref={mapBoxRef} className="relative min-w-0 flex-1 cursor-crosshair">
          <DeckGL
            viewState={view}
            onViewStateChange={({ viewState }) => setView({ ...viewState, transitionDuration: 0 })}
            controller={{ doubleClickZoom: false }}
            layers={layers}
            onClick={onDeckClick}
            getCursor={() => 'crosshair'}
            getTooltip={(info) => tooltipFor(info, sim, frame)}
          >
            <Map
              ref={mapRef}
              reuseMaps
              onLoad={onMapLoad}
              onIdle={onMapIdle}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              mapboxAccessToken={MAPBOX_TOKEN}
            />
          </DeckGL>

          {sim && <Legend hazard={sim.hazard} />}

          {!sim && !running && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className="max-w-sm rounded-xl border border-white/10 bg-[#0a0a0a]/85 p-4 backdrop-blur-md">
                <h2 className="text-[13px] font-semibold text-white/90">Nothing is running yet</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                  Click anywhere on the map to put an incident there. The model reads the
                  buildings, roads and water the basemap has loaded for that spot, so let the
                  tiles finish drawing before you judge the footprint count.
                </p>
              </div>
            </div>
          )}

          {sim && (
            <PlaybackBar
              sim={sim}
              tIndex={tIndex}
              onSeek={(t) => { setTIndex(t); setPlaying(false); }}
              playing={playing}
              onPlay={() => {
                if (tIndex >= sim.frames.length - 1) setTIndex(0);
                setPlaying((p) => (tIndex >= sim.frames.length - 1 ? true : !p));
              }}
              speedIndex={speedIndex}
              onSpeed={setSpeedIndex}
              clock={clock}
              event={eventNow}
            />
          )}
        </div>

        <aside className="w-[352px] shrink-0 space-y-3 overflow-y-auto border-l border-white/10 p-3">
          {!sim && (
            <Panel title="Readouts">
              <p className="text-[11px] leading-relaxed text-white/45">
                Every number on this side is derived from one timestep of the run. Place an
                incident and they fill in.
              </p>
            </Panel>
          )}
          {sim && frame && (
            <>
              <Headline sim={sim} frame={frame} />
              <HazardMetrics sim={sim} frame={frame} clock={clock} />
              <Exposure sim={sim} frame={frame} />
              <Facilities frame={frame} />
              <Evacuation plan={plan} />
              <ImpactCharts series={sim.series} tIndex={tIndex} footprint={frame.footprint} />
              <EventLog events={sim.eventLog} tIndex={tIndex} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
