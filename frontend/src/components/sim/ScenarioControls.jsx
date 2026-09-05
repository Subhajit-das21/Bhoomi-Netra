import { HAZARD_META } from '../../lib/simulationEngine';
import { Panel } from '../panels';

/**
 * The knobs that change the scenario. Everything here re-runs the model, so the
 * numbers on screen always belong to the settings on screen — there is no
 * "apply" button to forget to press.
 */

function display(control, value) {
  if (control.key === 'drainageQuality') return `${Math.round(value * 100)}%`;
  if (control.key === 'windDirDeg') return `${Math.round(value)}°`;
  const rounded = control.step < 1 ? value.toFixed(1) : Math.round(value);
  return control.unit ? `${rounded} ${control.unit}` : `${rounded}`;
}

function Slider({ label, value, display: shown, min, max, step, onChange, disabled }) {
  return (
    <label className="block select-none">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-white/55">{label}</span>
        <span className="text-[11px] tabular-nums text-white/85">{shown}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-white disabled:cursor-not-allowed"
      />
    </label>
  );
}

export default function ScenarioControls({
  hazard, params, onParam, radiusKm, onRadius, gridSize, onGridSize, disabled,
}) {
  const meta = HAZARD_META[hazard];
  return (
    <Panel title="Scenario" right={`${(radiusKm * 2).toFixed(1)} km across`}>
      <div className="space-y-3">
        <Slider
          label="Study radius"
          value={radiusKm}
          display={`${radiusKm.toFixed(2)} km`}
          min={0.5}
          max={4}
          step={0.25}
          onChange={onRadius}
          disabled={disabled}
        />
        {(meta?.controls || []).map((c) => (
          <Slider
            key={c.key}
            label={c.label}
            value={params[c.key] ?? c.def}
            display={display(c, params[c.key] ?? c.def)}
            min={c.min}
            max={c.max}
            step={c.step}
            onChange={(v) => onParam(c.key, v)}
            disabled={disabled}
          />
        ))}
        <Slider
          label="Grid resolution"
          value={gridSize}
          display={`${gridSize}² cells`}
          min={64}
          max={192}
          step={32}
          onChange={onGridSize}
          disabled={disabled}
        />
        <p className="text-[10px] leading-relaxed text-white/35">{meta?.blurb}</p>
      </div>
    </Panel>
  );
}
