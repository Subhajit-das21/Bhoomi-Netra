import type { Hazard, Severity } from './types';
import { colors } from '../theme/tokens';

/**
 * The severity design system.
 *
 * The central rule: severity is encoded by HOW MUCH of the card the colour
 * occupies, not by hue alone. A low alert is paper with a hairline rule; a
 * critical alert is a solid field of red oxide with cream type. Escalation is
 * therefore legible in greyscale, to a colourblind reader, and at arm's length
 * in sunlight — three things hue alone cannot deliver.
 *
 *   low       hairline rule, ink on paper
 *   medium    thicker rule, recessed surface
 *   high      full rule plus a tinted field
 *   critical  the whole card becomes the signal
 *
 * Class strings are literal so the NativeWind compiler can see them.
 */

export interface SeverityStyle {
  /** Sort weight. Higher is more urgent. */
  rank: number;
  /** The noun a citizen reads on the chip. */
  label: string;
  /** Outer container classes for a card at this severity. */
  card: string;
  /** Left rule width class. Empty for critical, where the field is the signal. */
  rule: string;
  /** Colour of the left rule. */
  ruleColor: string;
  /** Title text colour class. */
  title: string;
  /** Body text colour class. */
  body: string;
  /** Muted/meta text colour class that still clears 4.5:1 on this card. */
  meta: string;
  /** Solid severity chip: background and its text colour. */
  chip: string;
  chipText: string;
  /** Hex for icons and SVG, which cannot take a className. */
  accent: string;
  /**
   * Android vibration pattern, [wait, buzz, wait, buzz, ...] in ms.
   * Escalating insistence — critical is deliberately hard to ignore.
   */
  vibration: number[];
}

/**
 * Every pairing below is verified at >= 4.5:1.
 *
 * Note that the severity hue is never used as body text on a tinted ground:
 * terracotta on its own 10% wash is only 4.04:1. The hue lives in the rule and
 * in a solid chip; titles stay ink (or paper, on critical). That keeps the card
 * from turning monochrome and keeps the accent doing real work.
 */
export const SEVERITY: Record<Severity, SeverityStyle> = {
  low: {
    rank: 1,
    label: 'Monitor',
    card: 'bg-paper border border-low',
    rule: 'w-1',
    ruleColor: 'bg-low',
    title: 'text-ink',
    body: 'text-ink',
    meta: 'text-ink-soft',
    chip: 'bg-low',
    chipText: 'text-paper',
    accent: colors.low,
    vibration: [],
  },
  medium: {
    rank: 2,
    label: 'Prepare',
    card: 'bg-paper-deep',
    rule: 'w-1.5',
    ruleColor: 'bg-medium',
    title: 'text-ink',
    body: 'text-ink',
    meta: 'text-ink-soft',
    chip: 'bg-medium',
    chipText: 'text-paper',
    accent: colors.medium,
    vibration: [0, 180],
  },
  high: {
    rank: 3,
    label: 'Act now',
    card: 'bg-high-wash',
    rule: 'w-2',
    ruleColor: 'bg-high',
    title: 'text-ink',
    body: 'text-ink',
    meta: 'text-ink-soft',
    chip: 'bg-high',
    chipText: 'text-paper',
    accent: colors.high,
    vibration: [0, 260, 140, 260],
  },
  critical: {
    rank: 4,
    label: 'Leave now',
    card: 'bg-critical',
    rule: '',
    ruleColor: 'bg-critical',
    title: 'text-paper',
    body: 'text-paper',
    meta: 'text-paper',
    chip: 'bg-paper',
    chipText: 'text-critical',
    accent: colors.critical,
    vibration: [0, 500, 180, 500, 180, 800],
  },
};

/** Most urgent first; ties broken by most recent. */
export function compareUrgency(
  a: { severity: Severity; created_at: string },
  b: { severity: Severity; created_at: string },
): number {
  const bySeverity = SEVERITY[b.severity].rank - SEVERITY[a.severity].rank;
  if (bySeverity !== 0) return bySeverity;
  return Date.parse(b.created_at) - Date.parse(a.created_at);
}

/**
 * What to actually do, in one imperative sentence.
 *
 * Hazard-aware on purpose: "move to higher ground" is right for a flood and
 * actively wrong for a fire. Generic guidance is what gets people hurt.
 */
export function directive(hazard: Hazard, severity: Severity): string {
  if (hazard === 'flood') {
    switch (severity) {
      case 'critical':
        return 'Move to higher ground now. Do not try to drive through standing water.';
      case 'high':
        return 'Walk to the nearest shelter now. Take your phone, medicines and ID.';
      case 'medium':
        return 'Pack a bag you can carry and stay off low-lying roads.';
      case 'low':
        return 'No action needed yet. Check back if the rain gets heavier.';
    }
  }
  switch (severity) {
    case 'critical':
      return 'Leave now and move upwind, away from the smoke. Close doors behind you.';
    case 'high':
      return 'Leave if you can smell smoke. Do not wait to see flames.';
    case 'medium':
      return 'Clear dry leaves and fuel from around your home. Keep your phone charged.';
    case 'low':
      return 'No action needed yet. Avoid open fires and cooking outdoors.';
  }
}

/** The one-word stance, for chips and the map legend. */
export function stance(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return 'Evacuate';
    case 'high':
      return 'Move to shelter';
    case 'medium':
      return 'Get ready';
    case 'low':
      return 'Stay aware';
  }
}

export const HAZARD_LABEL: Record<Hazard, string> = {
  flood: 'Flooding',
  fire: 'Fire',
};
