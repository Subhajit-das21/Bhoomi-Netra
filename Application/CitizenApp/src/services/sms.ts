import { Linking } from 'react-native';

/**
 * The SOS that works on a congested tower.
 *
 * A flood is the normal case for a cell that has lost backhaul or is carrying ten
 * times its usual load, and in that state an HTTPS POST to Supabase will sit and
 * time out while a 140-byte SMS gets through on the control channel. This is the
 * channel that turns the SOS screen's offline state from a sentence into a way
 * out.
 *
 * The words are in domain/sms.ts, which imports nothing from the platform and so
 * can be asserted in plain Node. This file is only the handoff.
 *
 * ------------------------------------------------------------------
 * No recipient, on purpose
 * ------------------------------------------------------------------
 * The composer opens with the message written and the To field empty. That looks
 * like an omission and it is the opposite: I could not establish from here whether
 * India's 112 / ERSS accepts SMS, and hard-coding a shortcode that silently drops
 * messages would be the most dangerous line in this app — somebody would send it,
 * see it leave, and wait.
 *
 * So the user picks: a relative, a neighbour, a ward councillor, whoever they
 * actually know will read it. Whichever they choose, the body is already correct,
 * which is the part somebody with shaking hands cannot do for themselves. When the
 * district confirms a receiving number it becomes the `to` argument below, and
 * nothing else here changes.
 *
 * expo-sms is not installed and is not needed: `sms:` is a URL scheme both
 * platforms handle, and Sos.tsx already opens `tel:112` the same way.
 */

/**
 * Open the SMS composer with the body filled in.
 *
 * Resolves false when the platform has no messaging app to hand it to, which the
 * screen has to report rather than swallow: a button that appears to do nothing,
 * on the one screen where doing nothing is fatal, is worse than a button that
 * admits it cannot.
 */
export async function openEmergencySms(
  body: string,
  to: string = '',
): Promise<boolean> {
  // Android takes `?body=`, iOS wants `&body=` once there is a recipient. With the
  // To field empty both accept the query form — the other small reason the
  // recipient is left to the user.
  const url = `sms:${to}?body=${encodeURIComponent(body)}`;
  try {
    if (!(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
