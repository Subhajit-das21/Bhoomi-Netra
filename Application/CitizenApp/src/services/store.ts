import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The only thing this app writes to the device.
 *
 * Until now nothing survived a cold start — CitizenProvider says so in its own
 * header, and the alert cache is still deliberately in memory, because a shelter
 * roster read off disk may name a hall that closed hours ago. A household profile
 * is the opposite kind of data: it is about the person holding the phone, it does
 * not go stale in an afternoon, and asking someone to re-enter their address every
 * time they reopen the app would mean nobody ever answers the questions once.
 *
 * ------------------------------------------------------------------
 * Unencrypted, and that decides what may go in here
 * ------------------------------------------------------------------
 * The Expo docs describe AsyncStorage in exactly these words: "an asynchronous,
 * unencrypted, persistent, key-value storage solution". On Android it is a
 * SQLite file inside the app sandbox — unreadable by other apps on a device that
 * has not been rooted, readable by anyone with the handset and adb on one that
 * has, and it lands in an `adb backup` unless the manifest opts out.
 *
 * So: a name, a ward, an address and a count of who lives there. All of it was
 * typed in by the person holding the phone, and all of it is already on the
 * fridge door. What must never come through here is anything that grants access
 * to somebody else's data — no tokens, no keys, no other household's row.
 * expo-secure-store exists for that and is not installed, which is the right
 * amount of temptation.
 *
 * ------------------------------------------------------------------
 * Nothing here rejects
 * ------------------------------------------------------------------
 * Every function below swallows its own failure, and that is deliberate rather
 * than lazy. A full disk or a corrupt store must not stop the map from drawing:
 * the profile is a convenience, and losing it costs a form to fill in again. The
 * one thing that would be unforgivable is a safety app that will not open because
 * a key-value write failed.
 */

/**
 * Keys, listed in one place because a typo is silent — a misspelled read returns
 * null, which is indistinguishable from a first run.
 *
 * The `bn.` prefix namespaces us inside a store the whole app shares, and the
 * `v1` on the household record is there so that a future field the old shape
 * cannot express can be introduced by bumping the key rather than by writing a
 * migration that runs on a phone nobody can debug.
 */
export const StoreKey = {
  household: 'bn.household.v1',
  /** Only ever written when there is no platform id to use. See identity.ts. */
  fallbackDeviceId: 'bn.device.fallback',
  /** ISO stamp of the moment somebody chose "not now", so we stop asking. */
  onboardingDeclinedAt: 'bn.onboarding.declined',
} as const;

/** Read and parse. Null for absent, unreadable, or not valid JSON. */
export async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    // Two failures collapse into one answer on purpose. A read error and a
    // JSON.parse error both mean "there is nothing usable here", and the caller's
    // response to either is to treat this as a first run.
    return null;
  }
}

/** Write. Returns whether it landed, for callers that must not claim it did. */
export async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export async function readText(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeText(key: string, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Forget one key.
 *
 * There is no `clear()` wrapper here, and there should not be: AsyncStorage's own
 * `clear` empties the store for the entire app, and a helper that innocuous
 * sitting next to the household record is an accident waiting for a tired
 * evening. Deleting a profile means deleting the household key by name.
 */
export async function forget(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing useful to do. The value stays; the caller has already moved on in
    // memory, and the next write will overwrite it.
  }
}
