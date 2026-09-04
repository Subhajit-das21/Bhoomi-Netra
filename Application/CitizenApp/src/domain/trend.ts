import { adcToPercent } from './geo';
import type { Reading } from './types';

/**
 * Which way the water is going, and how fast.
 *
 * The provider already fetches two hundred readings and throws all but one of
 * them away. That one — the reading that tripped the alert — answers "how bad is
 * it" and cannot answer the question people actually ask at their front door,
 * which is "is it still coming up?". A sensor sitting at 76% of full scale means
 * one thing if it was at 74% an hour ago and something else entirely if it was at
 * 40%, and only the second is a reason to leave now.
 *
 * ------------------------------------------------------------------
 * Percentages of full scale, never centimetres
 * ------------------------------------------------------------------
 * These are raw 12-bit ADC counts. Turning them into centimetres of water needs a
 * per-node calibration against a staff gauge that this project does not have, and
 * inventing one would put a number on screen that a person would plan around —
 * "40 cm" reads as a measurement and would be a guess wearing a measurement's
 * clothes. So the copy says percentage points of the sensor's range, and the
 * shape of the line does the rest of the work.
 */

/** Percentage points. Below this, a change is sensor noise, not weather. */
const NOISE_POINTS = 2;

/**
 * How far back to look. Ninety minutes is long enough for a monsoon squall to
 * show a slope and short enough that this morning's dry spell cannot flatten it.
 */
const WINDOW_MS = 90 * 60 * 1000;

/** Fewest samples that can describe a direction rather than a coincidence. */
const MIN_SAMPLES = 3;

/** Enough to show a shape, few enough to draw legibly at thumbnail width. */
const MAX_SAMPLES = 24;

/** Below this span, two readings minutes apart would imply an absurd rate. */
const MIN_SPAN_MS = 5 * 60 * 1000;

export type Direction = 'rising' | 'falling' | 'steady';

/** Which of the ADC-count columns to read. All are 0–4095 and 12-bit. */
export type TrendField = 'water_level' | 'rain_level' | 'smoke_level';

export interface Trend {
  direction: Direction;
  /** Signed change across the window, in percentage points of full scale. */
  changePoints: number;
  /** Signed rate, percentage points per hour. */
  pointsPerHour: number;
  /** Minutes between the first and last sample used. */
  spanMinutes: number;
  /** The samples, oldest first, as percentages of full scale. For the sparkline. */
  series: number[];
  /** Where it is now, as a percentage of full scale. */
  latest: number;
}

/**
 * The trend for one sensor on one node, or null when there is not enough history
 * to claim one.
 *
 * Null is a real and common answer — a node that came online twenty minutes ago
 * has no trend — and it has to be distinguishable from 'steady'. "The water is
 * holding" and "we do not know yet" lead to different decisions, and a function
 * that collapsed them into one would be the more comfortable lie.
 *
 * `readings` is expected newest-first, the order data/queries.ts fetches in.
 */
export function sensorTrend(
  readings: Reading[],
  field: TrendField,
  now: number = Date.now(),
): Trend | null {
  const samples: { at: number; percent: number }[] = [];

  for (const r of readings) {
    const raw = r[field];
    if (raw === null) continue;
    const at = Date.parse(r.created_at);
    if (Number.isNaN(at)) continue;
    // Future timestamps are a clock disagreement between a node and this phone,
    // not data. Keeping them would put the newest sample in the wrong place and
    // invert the slope.
    if (at > now) continue;
    if (now - at > WINDOW_MS) break; // newest-first, so everything after is older
    samples.push({ at, percent: adcToPercent(raw) });
  }

  if (samples.length < MIN_SAMPLES) return null;

  // Oldest first from here on, which is the order a line is drawn in.
  samples.reverse();

  const first = samples[0];
  const last = samples[samples.length - 1];
  const spanMs = last.at - first.at;
  if (spanMs < MIN_SPAN_MS) return null;

  const changePoints = last.percent - first.percent;
  const spanMinutes = Math.round(spanMs / 60_000);
  const pointsPerHour = (changePoints * 3_600_000) / spanMs;

  return {
    direction:
      Math.abs(changePoints) < NOISE_POINTS
        ? 'steady'
        : changePoints > 0
          ? 'rising'
          : 'falling',
    changePoints: Math.round(changePoints),
    pointsPerHour: Math.round(pointsPerHour),
    spanMinutes,
    series: thin(samples.map((s) => s.percent), MAX_SAMPLES),
    latest: last.percent,
  };
}

/**
 * Reduce a series to at most `limit` points, keeping the first and the last.
 *
 * Evenly spaced indices rather than averaged buckets. A mean would smooth away
 * the spike that is the entire reason somebody is reading this screen, and on a
 * line forty pixels tall a smoothed spike and no spike look identical.
 */
export function thin(series: number[], limit: number): number[] {
  if (series.length <= limit) return series;
  const out: number[] = [];
  for (let i = 0; i < limit; i++) {
    out.push(series[Math.round((i * (series.length - 1)) / (limit - 1))]);
  }
  return out;
}

/** The readings from one node, newest first, as fetched. */
export function readingsFor(readings: Reading[], nodeId: string): Reading[] {
  return readings.filter((r) => r.node_id === nodeId);
}
