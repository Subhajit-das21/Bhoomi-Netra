import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { StoreKey, readText, writeText } from './store';

/**
 * Which handset this is.
 *
 * The household table has no accounts and no passwords, so this value is the only
 * credential in the whole household path: `restore_household`, `update_household`
 * and `mark_household_safe` each take one device id and can reach exactly the one
 * row it belongs to. Everything 007_households.sql claims about the anon key not
 * being able to enumerate households rests on this identifier being something an
 * attacker cannot guess and cannot read off another app.
 *
 * ------------------------------------------------------------------
 * Android: Settings.Secure.ANDROID_ID, via expo-application
 * ------------------------------------------------------------------
 * The Expo docs describe `getAndroidId()` as returning a value "unique to each
 * combination of app-signing key, user, and device". Three properties follow, and
 * all three are why this is the right identifier here rather than a UUID we mint:
 *
 *   It survives uninstall and reinstall. That is the whole reason profile recovery
 *   is possible at all — a phone reset by a flood, or handed to a relative to
 *   reinstall, comes back to the same row.
 *
 *   It is scoped to our signing key, so no other app on the phone sees the same
 *   value. It cannot be used to correlate this household with anything else the
 *   person does, which matters for a register of who is elderly and where.
 *
 *   It needs no permission and shows no dialog. A safety app that opens with a
 *   permission prompt is a safety app people close.
 *
 * It resets on factory reset and if the APK is re-signed. Both orphan the row, and
 * the retention function in 007 is what eventually clears the orphan.
 *
 * ------------------------------------------------------------------
 * iOS: identifierForVendor
 * ------------------------------------------------------------------
 * The nearest equivalent, and weaker: it changes once every app from this vendor
 * is removed from the device, so reinstall recovery is best-effort rather than
 * reliable. It can also resolve to null — before first unlock after a reboot, per
 * the docs — which is why this function is async on every platform even though the
 * Android call is synchronous.
 */

/**
 * The floor `households.device_id` enforces:
 * `CHECK (length(device_id) >= 16)`. It exists so nobody can probe the restore
 * function with '1', and it is the reason for the padding below.
 */
const MIN_DEVICE_ID_LENGTH = 16;

export interface DeviceIdentity {
  id: string;
  /**
   * Whether this identifier is expected to outlive an uninstall.
   *
   * False means we minted it ourselves and it lives in AsyncStorage, which the
   * uninstall takes with it. The distinction is not academic: it decides whether
   * the app may promise "your details will still be here if you reinstall", and
   * a safety app should not make a promise it knows it cannot keep.
   */
  durable: boolean;
}

/**
 * ANDROID_ID as a full 64-bit hex string.
 *
 * Android formats the value with `Long.toHexString`, which drops leading zeros —
 * so roughly one device in sixteen reports fifteen characters, one in 256 reports
 * fourteen, and so on down. Those handsets would be rejected by the length check
 * on `households.device_id` and could never save a profile: a bug that would have
 * looked like a random 6% failure rate on real devices and nothing at all on an
 * emulator.
 *
 * Padding restores the canonical form of the same number, so it is stable across
 * runs and across reinstalls, which is the only property that matters.
 */
function padded(androidId: string): string {
  return androidId.length >= MIN_DEVICE_ID_LENGTH
    ? androidId
    : androidId.padStart(MIN_DEVICE_ID_LENGTH, '0');
}

/**
 * A random hex id, for when the platform has none to offer.
 *
 * `crypto.getRandomValues` is feature-detected rather than assumed: React Native
 * does not ship a global `crypto`, Expo's runtime may or may not have polyfilled
 * one depending on what else is installed, and a missing global here would crash
 * the first launch. Where it is absent this falls back to `Math.random`, which
 * Hermes does not seed from a cryptographic source.
 *
 * That weaker path is acceptable only because of where it can be reached. On
 * Android — every handset this app is built for — ANDROID_ID always answers, so
 * this code never runs. It exists for iOS before first unlock and for the web
 * preview, neither of which will hold a real citizen's address.
 */
function randomId(): string {
  const bytes = new Uint8Array(16);
  const webcrypto = (globalThis as { crypto?: Crypto }).crypto;

  if (typeof webcrypto?.getRandomValues === 'function') {
    webcrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The id we minted for this install, made once and then remembered.
 *
 * Written through `writeText` and not trusted to have landed. If the write fails
 * the id is still returned so the session works, and the next launch mints a
 * different one — which orphans whatever was saved under the first. Reported as
 * `durable: false` either way, because from the caller's point of view a stored
 * fallback and an unstored one differ only in how soon they are lost.
 */
async function fallbackId(): Promise<string> {
  const existing = await readText(StoreKey.fallbackDeviceId);
  if (existing !== null && existing.length >= MIN_DEVICE_ID_LENGTH) {
    return existing;
  }

  const minted = randomId();
  await writeText(StoreKey.fallbackDeviceId, minted);
  return minted;
}

/**
 * Memoised for the session. Not for speed — the Android call is a cheap
 * synchronous read — but so that two screens asking at once cannot both find the
 * fallback key empty and mint two different ids.
 */
let cached: Promise<DeviceIdentity> | null = null;

export function deviceIdentity(): Promise<DeviceIdentity> {
  cached ??= resolve();
  return cached;
}

async function resolve(): Promise<DeviceIdentity> {
  if (Platform.OS === 'android') {
    try {
      const androidId = Application.getAndroidId();
      // Emulators have been known to report an empty string. Falling through is
      // better than saving a profile under an id every emulator shares.
      if (androidId && androidId.length > 0) {
        return { id: padded(androidId), durable: true };
      }
    } catch {
      // The docs do not document a throw here, but a native call that cannot
      // fail is a native call nobody has run on enough handsets.
    }
  }

  if (Platform.OS === 'ios') {
    try {
      const vendorId = await Application.getIosIdForVendorAsync();
      if (vendorId && vendorId.length >= MIN_DEVICE_ID_LENGTH) {
        return { id: vendorId, durable: true };
      }
    } catch {
      // Documented as resolvable to null rather than as throwing, but the same
      // reasoning applies.
    }
  }

  return { id: await fallbackId(), durable: false };
}
