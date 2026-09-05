import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Droplets, Flame, Wind } from 'lucide-react';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  Bar as RainBar, CartesianGrid, ComposedChart, Line as LevelLine, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis,
} from 'recharts';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { severityWeight, SEVERITY_ORDER } from '../lib/severity';
import { fetchWeather } from '../lib/weatherApi';
import {
  Bar, Button, Caveat, Chip, EmptyState, KeyValue, Metric, MetricGrid, PageHeader, Panel,
  WeightBar,
} from '../components/panels';

/**
 * The command centre landing page.
 *
 * Every figure on this page used to have an `|| fallback` behind it — `nodes.length
 * || 128`, `criticalAlerts || 7`, `uptime || 87.5` — which meant a quiet network
 * and a broken query looked identical to a busy one, and zero critical alerts
 * displayed as seven. Three invented incidents filled the list when the table was
 * empty, the weather was four hardcoded numbers, and "12,450 people across 4
 * districts" was a literal.
 *
 * None of that is here. Where there is no data the page says there is no data.
 *
 * The one derived number worth keeping is liveness: `sensor_nodes.status` is a
 * registry field that defaults to 'active' and nothing updates it, so the old
 * `status === 'online'` filter matched nothing and silently fell through to its
 * fallback. What a control room can actually check is whether a node has written
 * a reading recently, so that is what "reporting" means here.
 */

const SILENT_AFTER_MIN = 15;
const KOLKATA = [22.5726, 88.3639];

const HAZARD_ICON = { fire: Flame, flood: Droplets };

// The stock Leaflet pin, as this map used to draw its nodes. A pin whose tip lands
// on the coordinate points at the place; a circle centred on it only surrounds it.
// The images come from the installed package rather than unpkg, so the pins still
// draw when the control room has no route out to a CDN.
const nodeIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
  tooltipAnchor: [12, -24],
});

/**
 * Demonstration telemetry.
 *
 * The seeded `readings` are days old, so the live page correctly reads "0
 * reporting" and six nodes that last wrote "never" — true, and useless to show
 * anybody. With DEMO on, each node gets a freshly generated current reading and
 * the fleet gets a 24-hour hydrograph. Alerts, shelters and the weather are still
 * read from their real sources; set this to false and liveness goes back to the
 * `readings` table.
 */
const DEMO = true;

/** FNV-1a, so a node's figures are decided by its id and then hold still. */
function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: same seed, same numbers, so the panels do not flicker on a tick. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One current reading for a node, in the shape `readings` returns.
 *
 * A forest node sits hotter and drier than a riverside one, and its smoke matters
 * more than its water level, so the two kinds of site do not read identically.
 * `minute` walks each node through a few-minute write cycle, which is what keeps
 * the ages on screen moving instead of freezing at "just now".
 */
function demoReading(node, index, minute) {
  const rand = rng(seedOf(node.id));
  const forest = node.node_type === 'forest';
  const stress = rand();
  const ageMin = (minute + index * 2) % 5;
  return {
    node_id: node.id,
    created_at: new Date(Date.now() - (ageMin * 60000 + rand() * 45000)).toISOString(),
    temperature: Number(((forest ? 33 : 29) + stress * 9).toFixed(1)),
    humidity: Math.round((forest ? 62 : 74) + rand() * 18),
    smoke_level: Math.round(forest ? 180 + stress * 620 : 70 + stress * 180),
    water_level: Math.round(forest ? 260 + stress * 520 : 900 + stress * 2100),
    // Kept on the same scale as the hydrograph's right axis, so "now" in the panel
    // header and the last bar on the chart cannot contradict each other.
    rain_level: Math.round(stress * 26),
    // One site with the flame sensor tripped, so the panel that counts them has
    // something to count. Which one is decided by the seed, not by a coin toss.
    flame_detected: forest && stress > 0.55,
  };
}

/**
 * Twenty-four hours of fleet rainfall and mean water level.
 *
 * The level follows the rain with a few hours of catchment lag, which is why the
 * crest sits to the right of the squall rather than underneath it. A hydrograph
 * that peaked with the rain would be the wrong shape.
 */
function demoHydrograph() {
  const rand = rng(0x9e3779b9);
  const hours = [];
  for (let h = 23; h >= 0; h--) {
    const t = (23 - h) / 23;
    const squall = Math.max(0, Math.sin(t * 3.5 - 0.35));
    hours.push({
      at: new Date(Date.now() - h * 3600000),
      rain: Math.round(squall * 24 + rand() * 3),
    });
  }
  return hours.map((row, i) => {
    const soak = hours.slice(Math.max(0, i - 4), i + 1).reduce((a, r) => a + r.rain, 0);
    return {
      hour: `${String(row.at.getHours()).padStart(2, '0')}:00`,
      rain: row.rain,
      water: Math.round(420 + soak * 21 + rand() * 40),
    };
  });
}

// Rain carries the flood hue the map uses; the level line stays achromatic. Hue
// means which hazard, brightness means how much — the same rule as everywhere.
const RAIN_FILL = '#3f93b8';

const AXIS = {
  stroke: 'rgba(255,255,255,0.25)',
  tick: { fill: 'rgba(255,255,255,0.42)', fontSize: 10 },
};

function HydroTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-black/95 px-3 py-2 text-[11px]">
      <p className="mb-1 font-medium text-white/85">{label}</p>
      {payload.map((e) => (
        <div key={e.name} className="flex justify-between gap-4">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="text-white tabular-nums">
            {e.value}
            {e.dataKey === 'rain' ? ' mm/h' : ' cm'}
          </span>
        </div>
      ))}
    </div>
  );
}

function ageLabel(iso) {
  if (!iso) return 'never';
  const m = (Date.now() - new Date(iso).getTime()) / 60000;
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${h < 10 ? h.toFixed(1) : Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

const isFresh = (iso) => Boolean(iso)
  && (Date.now() - new Date(iso).getTime()) / 60000 <= SILENT_AFTER_MIN;

export default function Dashboard() {
  const [data, setData] = useState({
    nodes: [], alerts: [], latest: {}, shelters: [], zones: [],
  });
  const [state, setState] = useState(isSupabaseConfigured ? 'loading' : 'unconfigured');
  const [channel, setChannel] = useState('off');
  const [weather, setWeather] = useState('loading');
  const [minute, setMinute] = useState(0);

  const load = useCallback(async () => {
    const [nodeRes, alertRes, readingRes, shelterRes, zoneRes] = await Promise.all([
      supabase.from('sensor_nodes').select('id, name, node_type, status, latitude, longitude').order('name'),
      supabase.from('alerts').select('*, sensor_nodes(name)').eq('resolved', false)
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('readings').select('node_id, created_at, flame_detected, water_level')
        .order('created_at', { ascending: false }).limit(400),
      // Geometry columns are left out on purpose: PostgREST hands geography back as
      // WKB hex, and none of these panels draw a polygon.
      supabase.from('shelters').select('id, name, capacity, occupancy, status').order('name'),
      supabase.from('risk_zones').select('id, name, hazard_type, severity'),
    ]);

    if (nodeRes.error) {
      setState('error');
      return;
    }
    const latest = {};
    for (const r of readingRes.data || []) if (!latest[r.node_id]) latest[r.node_id] = r;

    setData({
      nodes: nodeRes.data || [],
      alerts: alertRes.data || [],
      latest,
      // These two tables belong to the citizen app. They may not be migrated in
      // every deployment, so their absence is a missing panel, not an error.
      shelters: shelterRes.error ? null : shelterRes.data || [],
      zones: zoneRes.error ? null : zoneRes.data || [],
    });
    setState('ready');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    load();

    const ch = supabase
      .channel('realtime-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, (p) => {
        const r = p.new;
        setData((prev) => (prev.latest[r.node_id]?.created_at > r.created_at
          ? prev
          : { ...prev, latest: { ...prev.latest, [r.node_id]: r } }));
      })
      .subscribe((status) => {
        setChannel(status === 'SUBSCRIBED' ? 'live' : 'connecting');
      });

    // A control room leaves this on a wall. Without a tick the "12 min ago" ages
    // stay frozen at whatever they were when the tab was opened.
    const tick = setInterval(() => setMinute((m) => m + 1), 60000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, [load]);

  const nodes = data.nodes;

  // Liveness, from generated readings when DEMO is on and from the table when it
  // is not. `minute` is in the dependency list on purpose: it advances each node
  // through its write cycle, so the ages on screen keep moving rather than ageing
  // into silence while the values themselves stay put.
  const latest = useMemo(() => {
    if (!DEMO || !nodes.length) return data.latest;
    const out = { ...data.latest };
    nodes.forEach((n, i) => { out[n.id] = demoReading(n, i, minute); });
    return out;
  }, [nodes, data.latest, minute]);

  const hydro = useMemo(() => (DEMO ? demoHydrograph() : []), []);

  // The fleet's own centre of gravity, so the map and the weather follow the
  // deployment instead of a hardcoded city.
  const centre = useMemo(() => {
    const pts = nodes.filter((n) => n.latitude != null && n.longitude != null);
    if (!pts.length) return KOLKATA;
    return [
      pts.reduce((a, n) => a + n.latitude, 0) / pts.length,
      pts.reduce((a, n) => a + n.longitude, 0) / pts.length,
    ];
  }, [nodes]);

  useEffect(() => {
    if (state !== 'ready' || !nodes.length) return undefined;
    let cancelled = false;
    fetchWeather(centre[0], centre[1]).then((w) => {
      if (!cancelled) setWeather(w || 'unavailable');
    });
    return () => { cancelled = true; };
  }, [state, nodes.length, centre]);

  const stats = useMemo(() => {
    const reporting = nodes.filter((n) => isFresh(latest[n.id]?.created_at)).length;
    const bySeverity = SEVERITY_ORDER.map((s) => ({
      label: s,
      value: data.alerts.filter((a) => a.severity === s).length,
      weight: severityWeight(s),
    }));
    // Worst unresolved severity per node, so the map can size a marker by the
    // gravity of what is actually open there rather than by a count.
    const worst = {};
    for (const a of data.alerts) {
      const w = severityWeight(a.severity);
      if (!worst[a.node_id] || w > worst[a.node_id].weight) {
        worst[a.node_id] = { weight: w, severity: a.severity, hazard: a.hazard_type };
      }
    }
    return {
      reporting,
      silent: nodes.length - reporting,
      bySeverity,
      critical: bySeverity[0].value,
      worst,
      flame: nodes.filter((n) => latest[n.id]?.flame_detected).length,
      // The worst single number the fleet is holding right now, for the panel
      // header — a maximum, not a mean, because a mean hides the one node in
      // trouble behind five that are fine.
      peakWater: nodes.reduce((a, n) => Math.max(a, latest[n.id]?.water_level ?? 0), 0),
      peakRain: nodes.reduce((a, n) => Math.max(a, latest[n.id]?.rain_level ?? 0), 0),
    };
  }, [nodes, data.alerts, latest]);

  const shelterTotals = useMemo(() => {
    if (!data.shelters?.length) return null;
    const open = data.shelters.filter((s) => s.status === 'open');
    return {
      count: data.shelters.length,
      openCount: open.length,
      capacity: data.shelters.reduce((a, s) => a + s.capacity, 0),
      occupancy: data.shelters.reduce((a, s) => a + s.occupancy, 0),
      openCapacity: open.reduce((a, s) => a + (s.capacity - s.occupancy), 0),
    };
  }, [data.shelters]);

  if (state !== 'ready') {
    return (
      <div className="h-full overflow-y-auto bg-black p-6 text-white/80">
        <PageHeader title="Command centre" />
        <Panel className="mt-4" bodyClass="p-0">
          {state === 'unconfigured' && (
            <EmptyState title="No database connection">
              Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and reload. This page
              shows what the network reports and nothing else, so without a connection
              it has nothing to show.
            </EmptyState>
          )}
          {state === 'loading' && <EmptyState title="Reading the network…" />}
          {state === 'error' && (
            <EmptyState title="The network query failed">
              Check the project URL, the anon key and the row-level-security policies.
            </EmptyState>
          )}
        </Panel>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-black p-6 text-white/80">
      <PageHeader
        title="Command centre"
        right={(
          <>
            {DEMO && <Chip weight={0.4}>Demo telemetry</Chip>}
            <Chip weight={channel === 'live' ? 0.8 : 0.25}>
              {channel === 'live' ? 'Live channel' : `Channel ${channel}`}
            </Chip>
            <Button onClick={load}>Refresh</Button>
          </>
        )}
      >
        {nodes.length} nodes registered, {stats.reporting} of them reporting within the
        last {SILENT_AFTER_MIN} minutes. Alerts, shelters and weather come from their own
        sources; sensor liveness is demonstration data while the seeded readings sit
        days behind.
      </PageHeader>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-4">
        <Panel bodyClass="p-3" className="xl:col-span-2">
          <MetricGrid cols={4}>
            <Metric label="Nodes" value={nodes.length} strong />
            <Metric
              label="Reporting"
              value={stats.reporting}
              sub={stats.silent ? `${stats.silent} silent` : 'all current'}
            />
            <Metric
              label="Unresolved alerts"
              value={data.alerts.length}
              sub={stats.critical ? `${stats.critical} critical` : 'none critical'}
            />
            <Metric
              label="Flame tripped"
              value={stats.flame}
              sub={stats.flame ? 'on the latest reading' : 'none on latest reading'}
            />
          </MetricGrid>
          <div className="mt-3">
            <WeightBar segments={stats.bySeverity} />
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {stats.bySeverity.map((s) => (
                <span key={s.label} className="text-[10px] text-white/40">
                  {s.value} {s.label}
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Weather at the fleet centre" bodyClass="p-3">
          {weather === 'loading' && <Caveat>Asking Open-Meteo…</Caveat>}
          {weather === 'unavailable' && (
            <Caveat>
              Open-Meteo did not answer. No cached figures are shown in its place.
            </Caveat>
          )}
          {weather && typeof weather === 'object' && (
            <>
              <Metric
                label={weather.description}
                value={weather.temperature != null ? weather.temperature.toFixed(1) : '—'}
                unit="°C"
                strong
              />
              <div className="mt-2">
                <KeyValue
                  label="Humidity"
                  value={weather.humidity != null ? `${weather.humidity}%` : 'not reported'}
                />
                <KeyValue
                  label="Wind"
                  value={weather.windSpeed != null ? `${weather.windSpeed} km/h` : 'not reported'}
                />
                <KeyValue
                  label="Precipitation"
                  value={weather.precipitation != null ? `${weather.precipitation} mm` : 'not reported'}
                />
              </div>
              <div className="mt-2">
                <Caveat>
                  Observed at {centre[0].toFixed(3)}, {centre[1].toFixed(3)} — the mean
                  of the node coordinates, not a district centroid.
                </Caveat>
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Shelter capacity"
          right={shelterTotals ? `${shelterTotals.openCount}/${shelterTotals.count} open` : null}
          bodyClass="p-3"
        >
          {!shelterTotals ? (
            <Caveat>
              No `shelters` table in this deployment, or nothing in it. This panel
              stays empty rather than estimating a headcount.
            </Caveat>
          ) : (
            <>
              <Metric
                label="Places still free in open shelters"
                value={shelterTotals.openCapacity.toLocaleString('en-IN')}
                sub={`${shelterTotals.occupancy.toLocaleString('en-IN')} of ${shelterTotals.capacity.toLocaleString('en-IN')} taken`}
                strong
              />
              <div className="mt-3 space-y-2">
                {data.shelters.map((s) => (
                  <div key={s.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="truncate text-white/60">{s.name}</span>
                      <span className="shrink-0 text-white/45 tabular-nums">
                        {s.occupancy}/{s.capacity}
                      </span>
                    </div>
                    <Bar value={s.occupancy} max={s.capacity} />
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Panel
            title="Node map"
            right={`${stats.reporting} reporting`}
            className="flex min-h-0 flex-1 flex-col"
            bodyClass="p-0 flex-1"
          >
            {!nodes.length ? (
              <EmptyState title="No nodes to plot">
                `sensor_nodes` is empty. Run the seed migration or register a node.
              </EmptyState>
            ) : (
              <div className="relative z-0 h-full min-h-[380px]">
                <MapContainer
                  center={centre}
                  zoom={11}
                  style={{ height: '100%', width: '100%', background: '#000' }}
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    className="map-tiles"
                  />
                  {nodes.filter((n) => n.latitude != null && n.longitude != null).map((n) => {
                    const open = stats.worst[n.id];
                    return (
                      <Marker key={n.id} position={[n.latitude, n.longitude]} icon={nodeIcon}>
                        <Tooltip>
                          <span className="font-medium">{n.name}</span>
                          {' — '}
                          {open ? `${open.severity} ${open.hazard}` : 'no open alert'}
                          {', '}
                          {ageLabel(latest[n.id]?.created_at)}
                        </Tooltip>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            )}
          </Panel>

          <Panel
            title="Fleet rainfall and water level, last 24 hours"
            right={`${stats.peakWater.toLocaleString('en-IN')} cm at the deepest node now`}
            bodyClass="p-3"
          >
            <div className="h-[186px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hydro} margin={{ top: 6, right: 0, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    interval={3}
                    {...AXIS}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis yAxisId="w" {...AXIS} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="r"
                    orientation="right"
                    width={26}
                    {...AXIS}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ChartTooltip content={<HydroTip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <RainBar
                    yAxisId="r"
                    dataKey="rain"
                    name="Rainfall"
                    fill={RAIN_FILL}
                    radius={[2, 2, 0, 0]}
                  />
                  <LevelLine
                    yAxisId="w"
                    dataKey="water"
                    name="Water level"
                    type="monotone"
                    stroke="rgba(255,255,255,0.8)"
                    strokeWidth={1.6}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-white/40">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: RAIN_FILL }} />
                  Rainfall mm/h, right axis
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-[2px] w-3.5 bg-white/75" />
                  Mean water level cm, left axis
                </span>
              </span>
              <span className="text-[10px] text-white/30 tabular-nums">
                {stats.peakRain} mm/h falling at the wettest node
              </span>
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel
            title="Unresolved alerts"
            right={<Link to="/alerts" className="hover:text-white/80">Full log</Link>}
            className="flex min-h-0 flex-1 flex-col"
            bodyClass="flex-1 space-y-2 overflow-y-auto p-3 min-h-[240px]"
          >
            {!data.alerts.length ? (
              <EmptyState title="Nothing unresolved">
                No open alert in the table. This is the network reporting quiet, not a
                missing query.
              </EmptyState>
            ) : data.alerts.slice(0, 8).map((a) => {
              const Icon = HAZARD_ICON[a.hazard_type] || Wind;
              const w = severityWeight(a.severity);
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-white/10 p-2.5"
                  style={{ background: `rgba(255,255,255,${0.015 + w * 0.05})` }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-white">
                      <Icon size={13} className="shrink-0 text-white/70" />
                      <span className="truncate">{a.sensor_nodes?.name || 'unknown node'}</span>
                    </span>
                    <Chip weight={w}>{a.severity}</Chip>
                  </div>
                  {a.message && (
                    <p className="mt-1 text-[11px] leading-relaxed text-white/55">{a.message}</p>
                  )}
                  <div className="mt-1 text-[10px] text-white/35 tabular-nums">
                    {a.hazard_type} · raised {ageLabel(a.created_at)}
                  </div>
                </div>
              );
            })}
          </Panel>

          <Panel title="Standing risk zones" bodyClass="p-3">
            {!data.zones?.length ? (
              <Caveat>
                No surveyed risk zones in this deployment. The Simulation page models a
                footprint from an incident instead.
              </Caveat>
            ) : (
              <div>
                {data.zones.map((z) => (
                  <KeyValue
                    key={z.id}
                    label={z.name}
                    value={<Chip weight={severityWeight(z.severity)}>{z.hazard_type}</Chip>}
                  />
                ))}
              </div>
            )}
          </Panel>

          {stats.silent > 0 && (
            <Panel title="Not reporting" right={`${stats.silent} nodes`} bodyClass="p-3">
              <div>
                {nodes.filter((n) => !isFresh(latest[n.id]?.created_at)).map((n) => (
                  <KeyValue
                    key={n.id}
                    label={n.name}
                    value={ageLabel(latest[n.id]?.created_at)}
                    dim
                  />
                ))}
              </div>
              <div className="mt-2">
                <Caveat>
                  Measured from the newest row in `readings`. The registry still lists
                  these as {nodes[0]?.status || 'active'}, which is a default, not a
                  heartbeat.
                </Caveat>
              </div>
            </Panel>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Caveat>
          {DEMO ? (
            <>
              Sensor liveness and the hydrograph above are a generated demonstration
              set — the seeded readings are days old, so a live page would show six
              silent nodes and an empty chart. Alerts, shelters and risk zones are read
              from the database, and the weather is Open-Meteo at the fleet centre.
              Nothing here is modelled: for modelled loss, casualties and evacuation
              routes, run the{' '}
            </>
          ) : (
            <>
              Sensor readings and alerts are live from the database. Weather is
              Open-Meteo at the fleet centre. Nothing on this page is modelled — for
              modelled loss, casualties and evacuation routes, run the{' '}
            </>
          )}
          <Link to="/simulation" className="text-white/60 underline">simulation</Link>.
        </Caveat>
      </div>
    </div>
  );
}
