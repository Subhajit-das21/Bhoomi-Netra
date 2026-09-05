import { Panel } from '../panels';

/**
 * What the model thinks happened, in order. Entries ahead of the timestep on
 * screen are dimmed rather than hidden — an operator scrubbing the timeline
 * wants to know what is coming, not be surprised by it.
 */

const KIND_TAG = {
  origin: 'start',
  spotting: 'spot fire',
  swept: 'wavefront',
  surge: 'surge',
  recession: 'peak',
  extreme: 'hazard',
  impact: 'impact',
};

export default function EventLog({ events, tIndex, className = '' }) {
  if (!events.length) {
    return (
      <Panel title="Event log" className={className}>
        <p className="text-[11px] text-white/40">Nothing has happened yet in this run.</p>
      </Panel>
    );
  }
  return (
    <Panel title="Event log" right={`${events.filter((e) => e.t <= tIndex).length} of ${events.length}`} className={className} bodyClass="p-0">
      <ol className="max-h-44 divide-y divide-white/5 overflow-y-auto">
        {events.map((e, i) => {
          const passed = e.t <= tIndex;
          return (
            <li
              key={`${e.kind}-${e.t}-${i}`}
              className={`flex gap-2 px-3 py-1.5 text-[11px] ${passed ? 'text-white/80' : 'text-white/30'}`}
            >
              <span className="w-14 shrink-0 tabular-nums text-white/40">{e.clock}</span>
              <span className="w-16 shrink-0 text-white/40">{KIND_TAG[e.kind] || e.kind}</span>
              <span className="min-w-0 flex-1">{e.text}</span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
