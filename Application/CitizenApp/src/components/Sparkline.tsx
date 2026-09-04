import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { thin, type Trend } from '../domain/trend';
import { colors } from '../theme/tokens';

/**
 * The shape of the last ninety minutes.
 *
 * One number — "water at 76%" — cannot answer the only question a person on a
 * ground floor is asking, which is whether it is still coming up. The sentence
 * next to this says so in words; the line says it in a glance, and a glance is
 * what somebody gets while pulling on shoes.
 *
 * ------------------------------------------------------------------
 * Why it carries no colour
 * ------------------------------------------------------------------
 * This sits inside the "Why you are seeing this" section, which is already on a
 * severity ground that has stated how bad things are. Tinting the line red for
 * rising would say it twice and would put a hue cue on the one element that has
 * to survive a cracked screen in direct sun. Ink for the line, the paper-deep rule
 * for the baseline, a single dot on the newest sample: direction is carried by the
 * geometry, which is the only encoding that works in greyscale.
 *
 * No axes, no gridlines, no labels. The numbers are in the sentence beneath it and
 * repeating them here would be decoration. What the frame does guarantee is the
 * y-scale: it is always 0–100% of the sensor's range, never fitted to the data, so
 * a 3-point wobble cannot draw itself as a cliff. That is the single most
 * important decision in this file — an auto-fitted sparkline is how a chart lies.
 */

/** Tall enough to read a slope off, short enough to sit inside a panel. */
const HEIGHT = 48;
/** Room for the newest-sample dot without clipping its stroke. */
const PAD = 4;
/**
 * Points across the line. More than this and the samples are closer together than
 * a fingertip is wide, so they cost pixels and tell nobody anything.
 */
const MAX_POINTS = 24;

export default function Sparkline({
  trend,
  width,
}: {
  trend: Trend;
  /** Measured by the caller, because SVG needs a number and Flex will not say. */
  width: number;
}) {
  const series = thin(trend.series, MAX_POINTS);
  if (width <= 0 || series.length < 2) return null;

  const innerW = width - PAD * 2;
  const innerH = HEIGHT - PAD * 2;

  // 0–100 of full scale, fixed. See the note above: fitting this to min/max would
  // turn sensor noise into a wall of water.
  const x = (i: number) => PAD + (i / (series.length - 1)) * innerW;
  const y = (percent: number) =>
    PAD + innerH - (clamp(percent) / 100) * innerH;

  const path = series
    .map((percent, i) => `${i === 0 ? 'M' : 'L'}${x(i)} ${y(percent)}`)
    .join(' ');

  const lastIndex = series.length - 1;
  const last = series[lastIndex];

  return (
    <View style={{ height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        {/* The floor of the range, so a line hugging the bottom still reads as
            low water rather than as missing data. */}
        <Line
          x1={PAD}
          y1={HEIGHT - PAD}
          x2={width - PAD}
          y2={HEIGHT - PAD}
          stroke={colors['paper-deep']}
          strokeWidth={1}
        />
        <Path
          d={path}
          stroke={colors.ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Where it is now. Without this the eye has to work out which end is the
            present, and on a line that is falling it will guess wrong. */}
        <Circle
          cx={x(lastIndex)}
          cy={y(last)}
          r={3.5}
          fill={colors.ink}
        />
      </Svg>
    </View>
  );
}

/**
 * Percentages come from `adcToPercent`, which already divides by 4095 — but a
 * miscalibrated node can report above full scale, and a point drawn outside the
 * frame would clip into the panel above rather than pinning at the top.
 */
function clamp(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}
