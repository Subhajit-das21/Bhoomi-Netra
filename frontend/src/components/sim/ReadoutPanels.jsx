import { Caveat, KeyValue, Metric, MetricGrid, Panel, WeightBar } from '../panels';
import { DAMAGE_LABELS, formatInr } from '../../lib/sim/exposure';
import { HAZARD_CLASS_LABELS } from '../../lib/sim/flood';
import { MMI_LABELS } from '../../lib/sim/quake';

/** Readouts for one timestep. Everything here is derived, nothing is decorative. */

const n0 = (v) => Math.round(v || 0).toLocaleString('en-IN');
const n1 = (v) => (v || 0).toFixed(1);
const n2 = (v) => (v || 0).toFixed(2);

/** Extensive plus destroyed — the two states you cannot move back into. */
const lost = (exposure, cls) => {
  const row = exposure.classDamage[cls];
  return row[3] + row[4];
};

export function Headline({ sim, frame }) {
  const m = frame.exposure;
  return (
    <Panel title={sim.hazardLabel} right={`${sim.provenance.counts.buildings} structures`}>
      <p className="text-[13px] leading-snug text-white/85">{sim.summary.headline}</p>
      <div className="mt-3">
        <MetricGrid cols={2}>
          <Metric
            label={frame.footprint.label}
            value={frame.footprint.unit === 'km²' ? n2(frame.footprint.value) : n0(frame.footprint.value)}
            unit={frame.footprint.unit}
            sub={`peak ${sim.peak.footprint < 10 ? n2(sim.peak.footprint) : n0(sim.peak.footprint)}`}
            strong
          />
          <Metric
            label="People displaced"
            value={n0(m.occupantsDisplaced)}
            sub={`${n0(m.occupantsAffected)} affected`}
            strong
          />
          <Metric label="Structures lost" value={n0(m.damageCounts[4])} sub={`${n0(m.damageCounts[3])} beyond repair`} />
          <Metric label="Damage" value={formatInr(m.lossInr)} sub={`peak ${formatInr(sim.peak.lossInr)}`} />
        </MetricGrid>
      </div>
    </Panel>
  );
}

function FireMetrics({ m }) {
  return (
    <>
      <MetricGrid cols={2}>
        <Metric label="Active front" value={n0(m.activeFrontCells)} unit="cells" />
        <Metric label="Perimeter" value={n1(m.perimeterM / 1000)} unit="km" />
        <Metric label="Peak spread" value={n1(m.maxRosMPerMin)} unit="m/min" />
        <Metric label="Flame length" value={n1(m.maxFlameLengthM)} unit="m" />
      </MetricGrid>
      <div className="mt-2 border-t border-white/5 pt-2">
        <KeyValue label="Fireline intensity" value={`${n0(m.meanIntensityKwM)} kW/m`} />
        <KeyValue label="Perimeter on a break" value={`${n0(m.heldPerimeterPct)}%`} />
        <KeyValue label="Spot fires so far" value={n0(m.spotFires)} />
        <KeyValue label="Downwind PM2.5" value={`${n0(m.smokePm25UgM3)} µg/m³`} />
        <KeyValue label="Air quality" value={`${m.smokeBand} (AQI ${n0(m.smokeAqi)})`} />
      </div>
    </>
  );
}

function FloodMetrics({ m }) {
  const total = m.hazardClassCounts.reduce((a, v) => a + v, 0);
  return (
    <>
      <MetricGrid cols={2}>
        <Metric label="Stage above datum" value={n2(m.stageM)} unit="m" />
        <Metric label="Deepest water" value={n2(m.maxDepthM)} unit="m" />
        <Metric label="Mean depth" value={n2(m.meanDepthM)} unit="m" />
        <Metric label="Volume held" value={n2(m.volumeMcm)} unit="Mm³" />
      </MetricGrid>
      <div className="mt-3">
        <div className="flex items-baseline justify-between pb-1 text-[11px] text-white/45">
          <span>Hazard rating, wet cells</span>
          <span className="text-white/70">{m.receding ? 'falling' : 'rising'}</span>
        </div>
        <WeightBar
          total={total}
          segments={m.hazardClassCounts.map((v, i) => ({
            label: HAZARD_CLASS_LABELS[i], value: v, weight: i / 3,
          }))}
        />
        <div className="pt-2">
          {m.hazardClassCounts.map((v, i) => (
            <KeyValue key={i} label={HAZARD_CLASS_LABELS[i]} value={`${n0((v / Math.max(1, total)) * 100)}%`} dim={v === 0} />
          ))}
        </div>
      </div>
    </>
  );
}

function QuakeMetrics({ m, seismology }) {
  return (
    <>
      <MetricGrid cols={2}>
        <Metric
          label="Peak intensity"
          value={`MMI ${n1(m.maxMmi)}`}
          sub={MMI_LABELS[Math.round(m.maxMmi)]}
        />
        <Metric label="Peak ground accel." value={n2(m.maxPgaG)} unit="g" />
        <Metric label="S wavefront" value={n1(m.sWaveRadiusKm)} unit="km" />
        <Metric label="Area shaken" value={n2(m.shakenAreaKm2)} unit="km²" />
      </MetricGrid>
      <div className="mt-2 border-t border-white/5 pt-2">
        <KeyValue label="Felt it" value={`${n0(m.populationFelt)} people`} />
        <KeyValue label="Strong shaking" value={`${n0(m.populationStrongShaking)} people`} />
        <KeyValue label="Felt radius" value={`${n1(seismology.feltRadiusKm)} km`} />
        <KeyValue label="Damaging radius" value={`${n1(seismology.damageRadiusKm)} km`} />
        <KeyValue label="Energy released" value={`${n0(seismology.energyTonsTnt)} t TNT`} />
        <KeyValue label="Largest aftershock to expect" value={`M${n1(seismology.expectedLargestAftershock)}`} />
        <KeyValue label="Aftershocks in 24 h" value={`about ${n0(seismology.expectedAftershocks24h)}`} />
      </div>
    </>
  );
}

export function HazardMetrics({ sim, frame, clock }) {
  const m = frame.metrics;
  return (
    <Panel title="Hazard now" right={clock}>
      {sim.hazard === 'fire' && <FireMetrics m={m} />}
      {sim.hazard === 'flood' && <FloodMetrics m={m} />}
      {sim.hazard === 'earthquake' && (
        <QuakeMetrics m={m} seismology={sim.summary.seismology} />
      )}
    </Panel>
  );
}

export function Exposure({ sim, frame }) {
  const e = frame.exposure;
  const total = sim.buildings.length || 1;
  return (
    <Panel title="Structures and people" right={`${n0(total)} in the study area`}>
      <WeightBar
        total={total}
        segments={e.damageCounts.map((v, i) => ({ label: DAMAGE_LABELS[i], value: v, weight: i / 4 }))}
      />
      <div className="pt-2">
        {e.damageCounts.map((v, i) => (
          <KeyValue key={i} label={DAMAGE_LABELS[i]} value={n0(v)} dim={v === 0} />
        ))}
      </div>
      <div className="mt-2 border-t border-white/5 pt-2">
        <KeyValue label="Informal / self-built beyond repair" value={n0(lost(e, 'informal'))} />
        <KeyValue label="Masonry beyond repair" value={n0(lost(e, 'masonry'))} />
        <KeyValue label="RC frame beyond repair" value={n0(lost(e, 'rc'))} />
      </div>
      <div className="mt-2 border-t border-white/5 pt-2">
        <KeyValue label="Dead" value={n0(e.casualties.fatal)} />
        <KeyValue label="Seriously hurt" value={n0(e.casualties.serious)} />
        <KeyValue label="Walking wounded" value={n0(e.casualties.light)} />
        <KeyValue label="Road cut" value={`${n1(e.severedLengthM / 1000)} km of ${n1((e.severedLengthM + e.openLengthM) / 1000)} km`} />
      </div>
      <Caveat>
        Casualty ratios are planning figures applied to inferred occupancy. They size the
        response; they are not a forecast of who gets hurt.
      </Caveat>
    </Panel>
  );
}

export function Facilities({ frame }) {
  const all = frame.exposure.facilityStatus;
  const hit = all.filter((f) => f.impacted);
  return (
    <Panel title="Critical facilities" right={`${hit.length} of ${all.length} affected`}>
      {all.length === 0 && (
        <p className="text-[11px] text-white/40">
          The basemap listed no hospital, school, police or fire station inside this area. That is
          a gap in the map, not proof there is nothing here.
        </p>
      )}
      {all.length > 0 && hit.length === 0 && (
        <p className="text-[11px] text-white/50">Nothing critical is affected at this step.</p>
      )}
      {hit.length > 0 && (
        <ul className="space-y-1.5">
          {hit.slice(0, 8).map((f, i) => (
            <li key={`${f.kind}-${i}`} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-white/85">{f.name || f.kindLabel}</span>
              <span className="shrink-0 text-white/45">
                {f.name ? `${f.kindLabel}, ${f.detail}` : f.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Evacuation({ plan }) {
  const corridors = plan?.corridors || [];
  return (
    <Panel title="Ways out" right={corridors.length ? `${corridors.length} clear` : null}>
      {!corridors.length && (
        <p className="text-[11px] text-white/50">{plan?.note || 'No route computed yet.'}</p>
      )}
      {corridors.length > 0 && (
        <ul className="space-y-2">
          {corridors.map((c, i) => (
            <li key={i} className="border-b border-white/5 pb-2 last:border-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-white/85">
                  {c.compass} to {c.target}
                </span>
                <span className="text-[11px] tabular-nums text-white/60">
                  {n0(c.meters)} m
                </span>
              </div>
              <KeyValue label="On foot" value={`${n0(c.walkSeconds / 60)} min`} />
              <KeyValue label="Driving" value={`${n0(c.driveSeconds / 60)} min`} />
              {c.compromisedMeters > 1 && (
                <KeyValue label="Through the hazard" value={`${n0(c.compromisedMeters)} m`} />
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function Provenance({ sim }) {
  const p = sim.provenance;
  return (
    <Panel
      title="Where this comes from"
      right={p.source === 'basemap' ? 'basemap tiles' : 'invented'}
    >
      <p className="text-[11px] leading-relaxed text-white/60">{p.sourceLabel}</p>
      <div className="mt-2 border-t border-white/5 pt-2">
        <KeyValue label="Footprints" value={n0(p.counts.buildings)} />
        <KeyValue label="Road lines" value={n0(p.counts.roads)} />
        <KeyValue label="Road graph nodes" value={n0(p.roadNodes)} />
        <KeyValue label="Facilities found" value={n0(p.counts.facilities)} />
        <KeyValue label="Built-up density from" value={p.builtUpSource} />
        <KeyValue label="Model run took" value={`${n0(sim.runtimeMs)} ms`} />
      </div>
      <ul className="mt-2 space-y-1 border-t border-white/5 pt-2">
        {sim.summary.assumptions.map((a, i) => (
          <li key={i} className="flex gap-1.5 text-[10px] leading-relaxed text-white/35">
            <span className="text-white/20">—</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
