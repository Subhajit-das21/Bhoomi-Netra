import React from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';
import { hasIndicScript } from '../../domain/i18n';
import {
  INDIC_LEADING,
  bodyStyle,
  dataStyle,
  displayMediumStyle,
  displayStyle,
  indicDisplayMediumStyle,
  indicDisplayStyle,
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
 *
 * ------------------------------------------------------------------
 * Why these components read their own children
 * ------------------------------------------------------------------
 * Bengali and Devanagari need a different face and a taller line box than Latin
 * (theme/type.ts says why). Both facts are decided by the glyphs on the line, not
 * by the household's language setting: a Bengali reader still sees a landmark that
 * has no dictionary entry in Latin, and that string wants the condensed face while
 * the headline above it does not.
 *
 * Reading `children` here also means no screen has to know about any of this.
 * Threading a `script` prop through forty call sites would have put the decision
 * in the one place that cannot get it right.
 */
type Props = TextProps & { className?: string };

/** The text this element will actually render, for script detection. */
function textOf(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return '';
  if (Array.isArray(children)) return children.map(textOf).join('');
  return '';
}

/**
 * A taller line box for stacked scripts, applied last so it beats the className.
 *
 * Returns null unless there is something to fix: no Indic glyphs, no explicit
 * leading to correct, or leading that is already generous enough.
 */
function indicLeading(
  children: React.ReactNode,
  style: TextProps['style'],
): TextStyle | null {
  if (!hasIndicScript(textOf(children))) return null;
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = flat?.fontSize;
  const lineHeight = flat?.lineHeight;
  if (!fontSize || !lineHeight) return null;
  const floor = Math.round(fontSize * INDIC_LEADING);
  return lineHeight < floor ? { lineHeight: floor } : null;
}

/** Headlines, alert titles, numbers that need to shout. Condensed, heavy. */
export function Display({ style, children, ...rest }: Props) {
  const indic = hasIndicScript(textOf(children));
  return (
    <Text
      {...rest}
      style={[
        indic ? indicDisplayStyle : displayStyle,
        style,
        indicLeading(children, style),
      ]}
    >
      {children}
    </Text>
  );
}

/** Section headings and button labels. Condensed, semibold. */
export function Subhead({ style, children, ...rest }: Props) {
  const indic = hasIndicScript(textOf(children));
  return (
    <Text
      {...rest}
      style={[
        indic ? indicDisplayMediumStyle : displayMediumStyle,
        style,
        indicLeading(children, style),
      ]}
    >
      {children}
    </Text>
  );
}

/** Running prose: guidance, descriptions, help text. Platform UI face. */
export function Body({ style, children, ...rest }: Props) {
  return (
    <Text {...rest} style={[bodyStyle, style, indicLeading(children, style)]}>
      {children}
    </Text>
  );
}

/**
 * Live values, distances, timestamps, coordinates. Tabular monospace.
 *
 * Keeps the monospace family even in Bengali. The digits are the reason this
 * component exists — they must not jitter as a live value ticks — and the words
 * around them fall back to a proportional Indic face on their own, which is the
 * right outcome rather than a compromise.
 */
export function Data({ style, children, ...rest }: Props) {
  return (
    <Text {...rest} style={[dataStyle, style, indicLeading(children, style)]}>
      {children}
    </Text>
  );
}
