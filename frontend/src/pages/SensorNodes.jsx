import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CloudFog, CloudRain, Droplets, Flame, Thermometer, Wind,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Caveat, Chip, EmptyState, KeyValue, Metric, MetricGrid, PageHeader, Panel,
} from '../components/panels';

/**
 * The sensor fleet.
 *
 * This page used to show a battery percentage and a radio type per node, with a
 * red/green battery icon keyed off the percentage. Neither column exists in
 * `sensor_nodes`: the battery was `80 + Math.random() * 20` recomputed on every
 * fetch, and the radio was inferred from `node_type`. Both are gone.
 *
 * What replaces them is the one liveness fact the database can actually answer —
 * how long since this node last wrote a reading. That is the number a control
 * room needs from a fleet page, it is measured rather than invented, and unlike a
 * fake battery it goes bad when the hardware does.
 */

// A node in this fleet writes on a few-minute cadence. A quarter of an hour of
// silence is not a slow sensor, it is a sensor to go and look at.
const SILENT_AFTER_MIN = 15;

const TYPE_LABEL = { forest: 'Forest', urban: 'Urban', universal: 'Universal' };

function minutesSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 60000;
}

function ageLabel(iso) {
  const m = minutesSince(iso);
  if (!Number.isFinite(m)) return 'never';
  if (m < 1) return 'just now';
  if (m < 60) return `${Math.round(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${h < 10 ? h.toFixed(1) : Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

const coord = (n) => (n.latitude != null && n.longitude != null
  ? `${n.latitude.toFixed(4)}, ${n.longitude.toFixed(4)}`
  : 'not surveyed');

/**
 * A reading's history as one line. Hand-rolled SVG rather than a chart library:
 * it is forty numbers in a table cell, and it has to survive a series that is
 * flat, empty or one point long without drawing something misleading.
 */
function Spark({ values, unit }) {
  const pts = values.filter((v) => v != null && Number.isFinite(v));
  if (pts.length < 2) {
    return <div className="h-8 text-[10px] text-white/25">not enough history</div>;
  }
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 100;
  const h = 28;
  const path = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <div className="flex items-end gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2"
          vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="shrink-0 text-[10px] whitespace-nowrap text-white/35 tabular-nums">
        {min === max ? `flat at ${min}${unit}` : `${min}–${max}${unit}`}
      </span>
    </div>
  );
}

const READOUTS = [
  { key: 'water_level', label: 'Water level', unit: ' cm', Icon: Droplets },
  { key: 'rain_level', label: 'Rainfall', unit: ' mm/h', Icon: CloudRain },
  { key: 'temperature', label: 'Temperature', unit: '°C', Icon: Thermometer },
  { key: 'humidity', label: 'Humidity', unit: '%', Icon: CloudFog },
  { key: 'smoke_level', label: 'Smoke', unit: '', Icon: Wind },
];

export default function SensorNodes() {
  const [nodes, setNodes] = useState([]);
  const [history, setHistory] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [state, setState] = useState(isSupabaseConfigured ? 'loading' : 'unconfigured');

  const load = useCallback(async () => {
    const [nodeRes, readingRes] = await Promise.all([
      supabase.from('sensor_nodes').select('*').order('name'),
      supabase.from('readings').select('*').order('created_at', { ascending: false }).limit(600),
    ]);
    if (nodeRes.error) {
      setState('error');
      return;
    }
    // Newest first per node, which is the order both the readout and the spark
    // want — the spark reverses it once rather than sorting per draw.
    const byNode = {};
    for (const r of readingRes.data || []) {
      if (!byNode[r.node_id]) byNode[r.node_id] = [];
      byNode[r.node_id].push(r);
    }
    setNodes(nodeRes.data || []);
    setHistory(byNode);
    setState('ready');
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    load();

    const channel = supabase
      .channel('realtime-readings')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'readings' }, (p) => {
        const r = p.new;
        setHistory((prev) => ({ ...prev, [r.node_id]: [r, ...(prev[r.node_id] || [])].slice(0, 120) }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // Derived during render rather than mirrored into state: the fleet list is the
  // only source of truth for what is selectable, so a node that disappears from
  // the table cannot leave a stale panel open beside it.
  const rows = useMemo(() => nodes.map((n) => {
    const readings = history[n.id] || [];
    const latest = readings[0] || null;
    const quietFor = minutesSince(latest?.created_at);
    return {
      ...n,
      readings,
      latest,
      quietFor,
      reporting: quietFor <= SILENT_AFTER_MIN,
      flame: Boolean(latest?.flame_detected),
    };
  }), [nodes, history]);

  const selected = rows.find((n) => n.id === selectedId) || rows[0] || null;
  const reporting = rows.filter((n) => n.reporting).length;
  const flaming = rows.filter((n) => n.flame).length;

  return (
    <div className="h-full overflow-y-auto bg-black p-6 text-white/80">
      <PageHeader title="Sensor fleet">
        Every node registered in `sensor_nodes`, with the newest reading each one has
        written. Liveness is measured from that timestamp — there is no battery or
        radio telemetry in this deployment, so this page does not pretend to have any.
      </PageHeader>

      {state !== 'ready' ? (
        <Panel className="mt-4" bodyClass="p-0">
          {state === 'unconfigured' && (
            <EmptyState title="No database connection">
              Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and reload.
            </EmptyState>
          )}
          {state === 'loading' && <EmptyState title="Reading the fleet…" />}
          {state === 'error' && (
            <EmptyState title="The fleet query failed">
              Check the project URL, the anon key and the policy on `sensor_nodes`.
            </EmptyState>
          )}
        </Panel>
      ) : (
        <>
          <div className="mt-4">
            <Panel bodyClass="p-3">
              <MetricGrid cols={4}>
                <Metric label="Nodes registered" value={rows.length} strong />
                <Metric
                  label="Reporting"
                  value={reporting}
                  sub={`within ${SILENT_AFTER_MIN} min`}
                />
                <Metric
                  label="Silent"
                  value={rows.length - reporting}
                  sub={rows.length - reporting ? 'no recent reading' : 'all nodes current'}
                />
                <Metric
                  label="Flame detected"
                  value={flaming}
                  sub={flaming ? 'on the latest reading' : 'none on latest reading'}
                />
              </MetricGrid>
            </Panel>
          </div>

          {!rows.length ? (
            <Panel className="mt-4" bodyClass="p-0">
              <EmptyState title="No nodes registered">
                `sensor_nodes` is empty. Run the seed migration or register a node.
              </EmptyState>
            </Panel>
          ) : (
            <div className="mt-4 grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-3">
              <Panel className="xl:col-span-2" bodyClass="p-0" title="Nodes"
                right={`${reporting}/${rows.length} current`}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[12px]">
                    <thead className="border-b border-white/10 text-[11px] text-white/40">
                      <tr>
                        <th className="px-4 py-2 font-medium">Node</th>
                        <th className="px-4 py-2 font-medium">Coordinates</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                        <th className="px-4 py-2 font-medium">Registry</th>
                        <th className="px-4 py-2 font-medium">Last reading</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.07]">
                      {rows.map((n) => (
                        <tr
                          key={n.id}
                          onClick={() => setSelectedId(n.id)}
                          className={`cursor-pointer transition-colors hover:bg-white/[0.05] ${
                            selected?.id === n.id ? 'bg-white/[0.07]' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 font-medium text-white">
                            {n.name}
                            {n.flame && (
                              <Flame size={12} className="ml-1.5 inline align-[-1px] text-white/80" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-white/55">{coord(n)}</td>
                          <td className="px-4 py-2.5 text-white/60">
                            {TYPE_LABEL[n.node_type] || n.node_type}
                          </td>
                          <td className="px-4 py-2.5 text-white/55">{n.status}</td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className="text-white/75 tabular-nums">
                                {ageLabel(n.latest?.created_at)}
                              </span>
                              {!n.reporting && (
                                <Chip weight={0.8} title={`Nothing written for over ${SILENT_AFTER_MIN} minutes`}>
                                  silent
                                </Chip>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              {selected && (
                <Panel
                  title={selected.name}
                  right={TYPE_LABEL[selected.node_type] || selected.node_type}
                  bodyClass="p-3 space-y-4"
                >
                  <div>
                    <KeyValue label="Coordinates" value={coord(selected)} />
                    <KeyValue label="Registry status" value={selected.status} />
                    <KeyValue label="Readings held" value={selected.readings.length} />
                    <KeyValue
                      label="Last wrote"
                      value={ageLabel(selected.latest?.created_at)}
                      dim={!selected.reporting}
                    />
                  </div>

                  {selected.latest?.flame_detected && (
                    <div className="flex items-center gap-2 rounded-lg border border-white/25 bg-white/[0.08] px-3 py-2">
                      <Flame size={14} className="shrink-0 text-white" />
                      <span className="text-[12px] text-white/85">
                        Flame sensor tripped on the latest reading
                      </span>
                    </div>
                  )}

                  {!selected.latest ? (
                    <EmptyState title="This node has never written a reading">
                      It is registered but silent. Nothing on this panel is estimated in
                      its place.
                    </EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {READOUTS.map(({ key, label, unit, Icon }) => {
                        const value = selected.latest[key];
                        const series = [...selected.readings].reverse().map((r) => r[key]);
                        return (
                          <div key={key} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-[11px] text-white/45">
                                <Icon size={13} /> {label}
                              </span>
                              <span className="text-[15px] font-semibold text-white tabular-nums">
                                {value != null ? `${value}${unit}` : (
                                  <span className="text-[11px] font-normal text-white/30">
                                    not reported
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="mt-1.5">
                              <Spark values={series} unit={unit} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <Caveat>
                    History is the last 600 readings across the fleet, so a busy node
                    carries a longer line than a quiet one. Ranges beside each line are
                    the min and max actually recorded, not a scale.
                  </Caveat>
                </Panel>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
