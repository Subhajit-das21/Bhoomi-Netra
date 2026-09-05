/**
 * Severity as a number, in one place.
 *
 * The database stores four words. Every panel needs them as a magnitude instead
 * — bar length, fill brightness, type weight — because this command centre does
 * not use red/amber/green: a colour-blind operator and a sun-washed projector
 * both lose that code, and hue is spent on the hazard itself on the map.
 */

export const SEVERITY_WEIGHT = { critical: 1, high: 0.72, medium: 0.45, low: 0.22 };

/** Unknown severities land mid-scale rather than reading as harmless. */
export const severityWeight = (s) => SEVERITY_WEIGHT[String(s).toLowerCase()] ?? 0.3;

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'];
