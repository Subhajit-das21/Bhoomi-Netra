/**
 * The small pieces every panel in the app is built from.
 *
 * Severity is carried by weight — type size, brightness, bar length — not by a
 * red/amber/green code, so the panels stay readable for colour-blind operators
 * and on a washed-out projector. Hue is reserved for the hazard itself on the
 * map, where it means something.
 *
 * These started life under `components/sim/` and were used only by the
 * simulation. They live here because the rest of the command centre needs the
 * same vocabulary: one card, one metric, one row, one caveat, everywhere.
 */

export function Panel({ title, right, children, className = '', bodyClass = 'p-3' }) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-[#0a0a0a]/85 backdrop-blur-md ${className}`}
    >
      {title && (
        <header className="flex items-baseline justify-between gap-3 border-b border-white/10 px-3 py-2">
          <h2 className="text-[13px] font-semibold text-white/85">{title}</h2>
          {right && <span className="text-[11px] text-white/40 tabular-nums">{right}</span>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Metric({ label, value, unit, sub, strong = false }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[11px] text-white/45">{label}</div>
      <div
        className={`flex items-baseline gap-1 tabular-nums ${
          strong ? 'text-2xl font-bold text-white' : 'text-lg font-semibold text-white/85'
        }`}
      >
        <span className="truncate">{value}</span>
        {unit && <span className="text-[11px] font-normal text-white/40">{unit}</span>}
      </div>
      {sub && <div className="truncate text-[10px] text-white/35">{sub}</div>}
    </div>
  );
}

// Written out rather than interpolated, because Tailwind only ships the class
// names it can see in the source.
const COLS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

export function MetricGrid({ cols = 2, children }) {
  return <div className={`grid gap-3 ${COLS[cols] || COLS[2]}`}>{children}</div>;
}

/** A stacked bar where each segment's brightness is its severity. */
export function WeightBar({ segments, total }) {
  const sum = total ?? segments.reduce((a, s) => a + s.value, 0);
  if (!sum) return <div className="h-1.5 rounded-full bg-white/5" />;
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
      {segments.map((s) => (
        <div
          key={s.label}
          className="h-full"
          style={{
            width: `${(s.value / sum) * 100}%`,
            background: `rgba(255,255,255,${0.12 + s.weight * 0.78})`,
          }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  );
}

export function KeyValue({ label, value, dim = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px] text-[11px]">
      <span className="truncate text-white/45">{label}</span>
      <span className={`shrink-0 tabular-nums ${dim ? 'text-white/50' : 'text-white/80'}`}>
        {value}
      </span>
    </div>
  );
}

export function Caveat({ children }) {
  return <p className="text-[10px] leading-relaxed text-white/35">{children}</p>;
}

/**
 * A severity or status tag. Achromatic: the fill carries the weight, so four
 * levels stay distinguishable in greyscale and none of them shouts. Weights come
 * from `lib/severity.js`, so one scale drives every page.
 */
export function Chip({ children, weight = 0.3, title }) {
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center rounded border px-1.5 py-[1px] text-[10px] font-medium whitespace-nowrap"
      style={{
        background: `rgba(255,255,255,${0.04 + weight * 0.14})`,
        borderColor: `rgba(255,255,255,${0.1 + weight * 0.34})`,
        color: `rgba(255,255,255,${0.55 + weight * 0.4})`,
      }}
    >
      {children}
    </span>
  );
}

/** One measure against its ceiling — occupancy, uptime, a share of a total. */
export function Bar({ value, max = 1, weight }) {
  const frac = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full"
        style={{
          width: `${frac * 100}%`,
          background: `rgba(255,255,255,${0.14 + (weight ?? frac) * 0.76})`,
        }}
      />
    </div>
  );
}

/**
 * The top of a route. A sentence, not a slogan: it says what the page counts and
 * where the numbers came from, because an operator arriving mid-shift should not
 * have to guess whether a figure is measured, modelled or absent.
 */
export function PageHeader({ title, children, right }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-white">{title}</h1>
        {children && (
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-white/45">{children}</p>
        )}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </header>
  );
}

/**
 * Nothing to show, said plainly. An empty table is a fact about the system, and
 * the old pages hid that fact behind invented rows.
 */
export function EmptyState({ title, children }) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
      <p className="text-[13px] text-white/60">{title}</p>
      {children && <p className="max-w-md text-[11px] leading-relaxed text-white/35">{children}</p>}
    </div>
  );
}

/** A control that does something. Disabled when it can't, never decorative. */
export function Button({ children, onClick, disabled = false, active = false, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-white/45 bg-white/15 text-white'
          : 'border-white/12 bg-white/[0.03] text-white/65 hover:enabled:border-white/25 hover:enabled:text-white'
      }`}
    >
      {children}
    </button>
  );
}
