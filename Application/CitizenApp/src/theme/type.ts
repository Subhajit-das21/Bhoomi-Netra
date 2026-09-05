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

/**
 * ------------------------------------------------------------------
 * Bengali and Devanagari
 * ------------------------------------------------------------------
 * The condensed faces above are Latin-only. Neither Roboto Condensed nor Avenir
 * Next Condensed has a single Bengali or Devanagari glyph, so a Bengali headline
 * never renders in them — the platform quietly falls back to Noto Sans Bengali on
 * Android and Kohinoor Bengali on iOS. That fallback is why there are no tofu
 * boxes without expo-font, and it is also why naming the condensed family on
 * Indic text is worse than saying nothing: the renderer then has a family with the
 * right *weight* and the wrong *coverage*, and synthesises a fake bold over the
 * fallback face. Faux bold on a stacked script smears the matras into the
 * headline stroke, which is exactly the part a reader uses to find the word.
 *
 * So Indic display type asks for the plain system family and a real 700, and lets
 * the fallback chain pick a face that actually has the weight cut.
 *
 * The cost is honest and worth naming: Bengali headlines lose the condensed
 * character this app's voice is built on, and about 15% of the characters per
 * line that theme/type.ts was chosen for. A translated headline therefore wraps
 * where its English key did not. That has to be looked at on a real screen.
 */
export const indicDisplayStyle = Platform.select({
  android: { fontFamily: 'sans-serif', fontWeight: '700' as const },
  default: { fontWeight: '700' as const },
});

export const indicDisplayMediumStyle = Platform.select({
  android: { fontFamily: 'sans-serif', fontWeight: '600' as const },
  default: { fontWeight: '600' as const },
});

/**
 * The line height a stacked script needs, as a floor rather than a redesign.
 *
 * Latin display type here runs tight on purpose — 46/46 on the siren line and
 * 28/32 on a headline read as one block of signage. Bengali and Devanagari cannot
 * take that: the matras sit above the headline stroke and the hasanta and conjunct
 * feet sit below it, so a line box sized for Latin caps clips the marks that
 * distinguish one word from another.
 *
 * 1.35 is chosen so that this only ever touches the sizes that need it. Running
 * text in this app is already set at 1.4–1.5 (16/24 body, 13/18 meta) and comes
 * out unchanged; only the four condensed display sizes, which are set at 1.0–1.2,
 * get opened up. A leading rule that quietly reflowed every paragraph in the app
 * the moment somebody chose Bengali would be the wrong trade.
 */
export const INDIC_LEADING = 1.35;
