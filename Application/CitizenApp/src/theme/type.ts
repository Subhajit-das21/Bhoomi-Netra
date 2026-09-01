import { Platform } from 'react-native';

/**
 * Typography for BHOOMI-NETRA Citizen.
 *
 * expo-font is not installed and the registry is unreachable in this
 * environment, so no webfont can be bundled. Rather than ship a config that
 * names Poppins and silently renders Roboto, this resolves faces that are
 * genuinely present on every target device.
 *
 * The pairing is a deliberate choice, not a fallback:
 *
 *   display — a CONDENSED grotesque. Condensed sans is the typography of public
 *   infrastructure: railway indicator boards, ward notices, ambulance livery,
 *   civil-defence signage. It also buys ~15% more characters per line, which
 *   matters when a headline has to say "Water rising in Ward 58 — leave now"
 *   on a 320pt screen without wrapping to three lines.
 *     Android: sans-serif-condensed (Roboto Condensed)
 *     iOS:     Avenir Next Condensed
 *
 *   body — the platform UI face, at rest and highly legible at small sizes.
 *     Android: sans-serif (Roboto)  /  iOS: SF Pro
 *
 *   data — monospaced, so tabular figures do not jitter as live sensor values
 *   tick. Used for readings, distances, countdowns, coordinates.
 *     Android: monospace (Roboto Mono)  /  iOS: Menlo
 */
export const fontFamily = {
  display: Platform.select({
    android: 'sans-serif-condensed',
    ios: 'AvenirNextCondensed-DemiBold',
    default: 'System',
  }),
  displayHeavy: Platform.select({
    android: 'sans-serif-condensed',
    ios: 'AvenirNextCondensed-Bold',
    default: 'System',
  }),
  body: Platform.select({
    android: 'sans-serif',
    ios: 'System',
    default: 'System',
  }),
  data: Platform.select({
    android: 'monospace',
    ios: 'Menlo',
    default: 'monospace',
  }),
};

/**
 * On iOS the weight is baked into the family name, so setting fontWeight as
 * well makes the renderer synthesise a second bold pass. Android needs the
 * explicit weight because sans-serif-condensed is a single family.
 */
export const displayStyle = Platform.select({
  android: { fontFamily: fontFamily.display, fontWeight: '700' as const },
  ios: { fontFamily: fontFamily.displayHeavy },
  default: { fontFamily: fontFamily.display, fontWeight: '700' as const },
});

export const displayMediumStyle = Platform.select({
  android: { fontFamily: fontFamily.display, fontWeight: '600' as const },
  ios: { fontFamily: fontFamily.display },
  default: { fontFamily: fontFamily.display, fontWeight: '600' as const },
});

export const bodyStyle = { fontFamily: fontFamily.body };

export const dataStyle = { fontFamily: fontFamily.data };
