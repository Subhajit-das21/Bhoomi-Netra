import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis,
  YAxis,
} from 'recharts';
import { severityWeight, SEVERITY_ORDER } from '../lib/severity';
import {
  Bar as WeightedBar, Button, Caveat, Chip, KeyValue, Metric, MetricGrid, PageHeader,
  Panel, WeightBar,
} from '../components/panels';

/**
 * Analytics, running on a generated dataset.
 *
 * The numbers on this page are synthetic — a demonstration set built in the
 * browser, not a query. It is labelled as such in the header and in the panel at
 * the bottom, because a chart that cannot be told apart from a measured one is
 * the thing worth avoiding, not the demo itself.
 *
 * The shape is deliberate rather than random: a wet spell moves through the
 * window, and alert count, severity mix and water level all follow it, so the
 * three charts agree with each other the way real ones would. The set is seeded
 * from the window length, so switching 7/30/90 days and back gives the same
 * figures instead of reshuffling under the reader.
 *
 * To put this page back on the live tables, replace `buildDemoData` with the
 * `alerts` and `readings` queries — everything below it already works off rows
 * in the database's own shape.
 */

const WINDOWS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

// The hazard hues the map already uses, dropped in brightness so a chart of them
// sits inside this interface rather than shouting over it. Hue here means the
// same thing it means on the map: which hazard, not how bad.
const HAZARD_COLOR = { flood: '#3f93b8', fire: '#c07a3c' };

// The seeded fleet, so the demo names match the nodes the rest of the app shows.
// The number beside each is how much of its traffic is flood rather than fire —
// the riverside and low-lying sites flood, the dry parkland burns.
const NODES = [
  { name: 'Howrah Bridge West', flood: 0.92 },
  { name: 'Sundarbans Edge Alpha', flood: 0.84 },
  { name: 'Salt Lake Sector V', flood: 0.68 },
  { name: 'New Town Eco Park', flood: 0.5 },
  { name: 'Jadavpur Campus', flood: 0.36 },
  { name: 'Rabindra Sarobar Park', flood: 0.22 },
  { name: 'Demo δ', flood: 0 },
];

/** mulberry32: same seed, same dataset, so a re-render does not reshuffle the page. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A timestamp inside the local day `back` days ago, never spilling into the next. */
function stampOn(back, hour, minute) {
  const d = new Date();
  d.setDate(d.getDate() - back);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Wet days skew the severity mix worse, which is what makes the bars agree. */
function severityFor(swell, r) {
  const x = r - swell * 0.22;
  if (x < 0.09) return 'critical';
  if (x < 0.32) return 'high';
  if (x < 0.64) return 'medium';
  return 'low';
}

const MESSAGE = {
  flood: (v) => `Water level ${v} cm and rising, above the 1,800 cm mark`,
  fire: (v) => `Smoke ${v} with the flame sensor tripped`,
};

/**
 * Alerts and readings in the same shape PostgREST returns them, so the aggregation
 * below this point is the same code a live query would feed.
 */
function buildDemoData(days) {
  const rand = rng(days * 7919 + 13);
  const alerts = [];
  const readings = [];
  let id = 0;

  for (let back = days - 1; back >= 0; back--) {
    // One wet spell moving through the window, plus a smaller second crest.
    const t = (days - back) / days;
    const swell = Math.max(0, Math.sin(t * 5.6 - 0.5)) * 0.8
      + Math.max(0, Math.sin(t * 2.1 - 1.4)) * 0.35;
    const clamped = Math.min(1, swell);

    // Twelve readings a day per node — a coarse cadence, but enough for a daily peak.
    for (let k = 0; k < 12; k++) {
      const wobble = rand();
      readings.push({
        created_at: stampOn(back, k * 2, Math.floor(wobble * 59)),
        water_level: Math.round(240 + clamped * 1900 + wobble * 260),
      });
    }

    const count = Math.round(clamped * 5.5 + rand() * 2.2);
    for (let k = 0; k < count; k++) {
      const node = NODES[Math.floor(rand() * NODES.length)];
      const hazard = rand() < node.flood ? 'flood' : 'fire';
      const severity = severityFor(clamped, rand());
      const reading = hazard === 'flood'
        ? Math.round(1800 + clamped * 1200 + rand() * 200)
        : Math.round(420 + clamped * 380 + rand() * 120);
      alerts.push({
        id: `demo-${(id += 1)}`,
        created_at: stampOn(back, 6 + Math.floor(rand() * 15), Math.floor(rand() * 59)),
        hazard_type: hazard,
        severity,
        message: MESSAGE[hazard](reading.toLocaleString('en-IN')),
        // Yesterday and earlier is mostly closed; today's is mostly still open.
        resolved: back > 1 ? rand() < 0.88 : rand() < 0.25,
        sensor_nodes: { name: node.name },
      });
    }
  }

  return { alerts, readings };
}

const dayKey = (d) => new Date(d).toLocaleDateString('en-CA');
const dayLabel = (key) => new Date(`${key}T12:00:00`).toLocaleDateString([], {
  day: 'numeric', month: 'short',
});

/** Every day in the window, oldest first, so absent days survive as zeroes. */
function dayAxis(days) {
  const out = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

const AXIS = {
  stroke: 'rgba(255,255,255,0.25)',
  tick: { fill: 'rgba(255,255,255,0.42)', fontSize: 11 },
};

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/15 bg-black/95 px-3 py-2 text-[11px]">
      <p className="mb-1 font-medium text-white/85">{dayLabel(label)}</p>
      {payload.map((e) => (
        <div key={e.name} className="flex justify-between gap-4">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="text-white tabular-nums">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(7);
  const { alerts, readings } = useMemo(() => buildDemoData(days), [days]);

  const model = useMemo(() => {
    const axis = dayAxis(days);
    const byDay = new Map(axis.map((k) => [k, {
      day: k, flood: 0, fire: 0, readings: 0, peakWater: null,
    }]));

    for (const a of alerts) {
      const row = byDay.get(dayKey(a.created_at));
      if (row) row[a.hazard_type] = (row[a.hazard_type] || 0) + 1;
    }
    for (const r of readings) {
      const row = byDay.get(dayKey(r.created_at));
      if (!row) continue;
      row.readings += 1;
      if (r.water_level != null && (row.peakWater == null || r.water_level > row.peakWater)) {
        row.peakWater = r.water_level;
      }
    }

    const bySeverity = SEVERITY_ORDER.map((s) => ({
      label: s,
      value: alerts.filter((a) => a.severity === s).length,
      weight: severityWeight(s),
    }));

    // Which nodes are doing the raising. A single node behind most of the alerts
    // is either the worst place in the district or a sensor that needs looking at,
    // and both are worth knowing before reading the totals.
    const perNode = new Map();
    for (const a of alerts) {
      const name = a.sensor_nodes?.name || 'unknown node';
      const cur = perNode.get(name) || { name, total: 0, worst: 0, flood: 0, fire: 0 };
      cur.total += 1;
      cur[a.hazard_type] += 1;
      cur.worst = Math.max(cur.worst, severityWeight(a.severity));
      perNode.set(name, cur);
    }

    const severe = bySeverity[0].value + bySeverity[1].value;

    return {
      series: axis.map((k) => byDay.get(k)),
      bySeverity,
      nodes: [...perNode.values()].sort((a, b) => b.total - a.total),
      total: alerts.length,
      resolved: alerts.filter((a) => a.resolved).length,
      severe,
      severeShare: alerts.length ? (severe / alerts.length) * 100 : 0,
      readingCount: readings.length,
      quietDays: axis.filter((k) => byDay.get(k).readings === 0).length,
      busiest: axis.reduce((best, k) => {
        const row = byDay.get(k);
        const n = row.flood + row.fire;
        return n > best.n ? { key: k, n } : best;
      }, { key: null, n: 0 }),
    };
  }, [alerts, readings, days]);

  return (
    <div className="h-full overflow-y-auto bg-black p-6 text-white/80">
      <PageHeader
        title="Analytics"
        right={(
          <>
            <Chip weight={0.4}>Demo data</Chip>
            {WINDOWS.map((w) => (
              <Button key={w.days} onClick={() => setDays(w.days)} active={days === w.days}>
                {w.label}
              </Button>
            ))}
          </>
        )}
      >
        {model.total} alerts and {model.readingCount.toLocaleString('en-IN')} readings over
        the last {days} days, from a generated demonstration set rather than the tables.
      </PageHeader>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel bodyClass="p-3" className="xl:col-span-2">
          <MetricGrid cols={4}>
            <Metric label="Alerts raised" value={model.total} strong />
            <Metric
              label="High or critical"
              value={model.severe}
              sub={`${model.severeShare.toFixed(1)}% of alerts`}
            />
            <Metric
              label="Still unresolved"
              value={model.total - model.resolved}
              sub={`${model.resolved} closed`}
            />
            <Metric
              label="Readings held"
              value={model.readingCount.toLocaleString('en-IN')}
              sub={`${model.quietDays} days with none`}
            />
          </MetricGrid>
          <div className="mt-3">
            <WeightBar segments={model.bySeverity} />
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {model.bySeverity.map((s) => (
                <span key={s.label} className="text-[10px] text-white/40">
                  {s.value} {s.label}
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Busiest day" bodyClass="p-3">
          <Metric
            label={dayLabel(model.busiest.key)}
            value={model.busiest.n}
            unit={model.busiest.n === 1 ? 'alert' : 'alerts'}
            strong
          />
          <div className="mt-2">
            <KeyValue label="Window" value={`${days} days to today`} />
            <KeyValue label="Hazards modelled" value="flood, fire" dim />
            <KeyValue label="Nodes in the set" value={model.nodes.length} />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Alerts per day, by hazard" right={`${model.total} total`} bodyClass="p-3">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={model.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={dayLabel}
                  interval="preserveStartEnd"
                  {...AXIS}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis allowDecimals={false} {...AXIS} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
                <Bar dataKey="flood" name="Flood" stackId="h" fill={HAZARD_COLOR.flood} />
                <Bar dataKey="fire" name="Fire" stackId="h" fill={HAZARD_COLOR.fire} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Peak water level per day" right="highest reading each day" bodyClass="p-3">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={model.series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickFormatter={dayLabel}
                  interval="preserveStartEnd"
                  {...AXIS}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis {...AXIS} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Line
                  type="monotone"
                  dataKey="peakWater"
                  name="Peak level"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth={1.6}
                  dot={{ r: 2, fill: 'rgba(255,255,255,0.75)', strokeWidth: 0 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Where the alerts came from"
          right={`${model.nodes.length} nodes`}
          bodyClass="p-3"
        >
          <div className="space-y-2.5">
            {model.nodes.map((n) => (
              <div key={n.name}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[12px] text-white/75">{n.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-[10px] text-white/35">
                      {n.flood ? `${n.flood} flood` : ''}
                      {n.flood && n.fire ? ', ' : ''}
                      {n.fire ? `${n.fire} fire` : ''}
                    </span>
                    <span className="text-[12px] text-white tabular-nums">{n.total}</span>
                  </span>
                </div>
                <WeightedBar value={n.total} max={model.nodes[0].total} weight={n.worst} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="About this dataset" bodyClass="p-3 space-y-2">
          <KeyValue label="Source" value="generated in the browser" dim />
          <KeyValue label="Seed" value={`window length (${days})`} dim />
          <KeyValue label="Live tables" value="not queried on this page" dim />
          <Caveat>
            Every figure above is synthetic, built to demonstrate the charts rather than
            to report the network. It is seeded from the window length, so the same
            window always shows the same numbers, and a wet spell drives the alert count,
            the severity mix and the water level together. The Command centre, Alert log
            and Sensor fleet pages are unchanged and still read the database directly.
          </Caveat>
        </Panel>
      </div>
    </div>
  );
}
