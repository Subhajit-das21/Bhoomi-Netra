import React from 'react';
import { Text, type TextProps } from 'react-native';
import {
  bodyStyle,
  dataStyle,
  displayMediumStyle,
  displayStyle,
} from '../../theme/type';

/**
 * Typography primitives.
 *
 * Typography is the one axis this project does NOT express as a Tailwind
 * utility: the display and data faces differ per platform (see theme/type.ts),
 * and tailwind.config.js is evaluated in Node where Platform.OS is meaningless.
 * Centralising it in four components keeps a single source of truth instead of
 * scattering Platform.select into screens.
 *
 * Everything else — colour, size, weight, tracking, leading — stays in
 * className so it still reads as one system.
 */
type Props = TextProps & { className?: string };

/** Headlines, alert titles, numbers that need to shout. Condensed, heavy. */
export function Display({ style, ...rest }: Props) {
  return <Text {...rest} style={[displayStyle, style]} />;
}

/** Section headings and button labels. Condensed, semibold. */
export function Subhead({ style, ...rest }: Props) {
  return <Text {...rest} style={[displayMediumStyle, style]} />;
}

/** Running prose: guidance, descriptions, help text. Platform UI face. */
export function Body({ style, ...rest }: Props) {
  return <Text {...rest} style={[bodyStyle, style]} />;
}

/** Live values, distances, timestamps, coordinates. Tabular monospace. */
export function Data({ style, ...rest }: Props) {
  return <Text {...rest} style={[dataStyle, style]} />;
}
