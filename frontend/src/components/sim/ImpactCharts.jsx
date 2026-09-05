import {
  Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Panel } from '../panels';

/**
 * Small multiples over the run. All three share one x axis and carry a marker at
 * the timestep on screen, so the map and the curves cannot disagree about when
 * something happened.
 */

const AXIS = { stroke: 'rgba(255,255,255,0.25)', fontSize: 9 };

function Spark({ series, dataKey, label, current, unit, tIndex, decimals = 0 }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 pb-1">
        <span className="text-[11px] text-white/55">{label}</span>
        <span className="text-[11px] tabular-nums text-white/85">
          {current.toFixed(decimals)}
          {unit ? <span className="text-white/40"> {unit}</span> : null}
        </span>
      </div>
      <div className="h-14">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <XAxis dataKey="t" tick={AXIS} axisLine={false} tickLine={false} hide />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: '#0a0a0a',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                fontSize: 11,
              }}
              labelFormatter={(t) => series[t]?.clock ?? `step ${t}`}
              formatter={(v) => [Number(v).toFixed(decimals), label]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={1.4}
              fill="rgba(255,255,255,0.12)"
              isAnimationActive={false}
            />
            <ReferenceLine x={tIndex} stroke="rgba(255,255,255,0.55)" strokeDasharray="2 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function ImpactCharts({ series, tIndex, footprint }) {
  const now = series[tIndex] || series[series.length - 1] || {};
  return (
    <Panel title="Over the run" right={now.clock}>
      <div className="space-y-3">
        <Spark
          series={series}
          dataKey="footprint"
          label={footprint.label}
          unit={footprint.unit}
          current={now.footprint ?? 0}
          decimals={footprint.unit === 'km²' ? 2 : 0}
          tIndex={tIndex}
        />
        <Spark
          series={series}
          dataKey="displaced"
          label="People displaced"
          current={now.displaced ?? 0}
          tIndex={tIndex}
        />
        <Spark
          series={series}
          dataKey="lossCr"
          label="Damage"
          unit="₹ cr"
          current={now.lossCr ?? 0}
          decimals={2}
          tIndex={tIndex}
        />
      </div>
    </Panel>
  );
}
