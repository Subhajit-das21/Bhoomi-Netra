import * as Location from 'expo-location';

/**
 * Where the phone actually is.
 *
 * Every safety decision in this app is a function of one pair of coordinates:
 * which zone you are standing in, which shelter is nearest and whether the walk
 * to it crosses water, what the SOS payload says, where the map centres. Until
 * now that pair was a constant in data/device.ts. This is the seam that file
 * always described, now filled in.
 *
 * ------------------------------------------------------------------
 * Foreground only, and deliberately
 * ------------------------------------------------------------------
 * `watchPositionAsync` stops when the app is backgrounded. Background location on
 * Android needs FOREGROUND_SERVICE_LOCATION, a persistent notification and a
 * written justification to Google Play review; on iOS it needs a development
 * build and a second permission prompt. None of that is earned yet, because this
 * app cannot deliver a push notification either (expo-notifications is absent —
 * Settings says so), so a position tracked while the screen is off would have
 * nothing to do with the knowledge.
 *
 * ------------------------------------------------------------------
 * Accuracy.High, not Balanced
 * ------------------------------------------------------------------
 * The documented default is `Balanced`, which the Expo docs put at roughly 100 m.
 * A flood zone boundary runs down the middle of a street, and this app tells
 * people which side of it they are on — at 100 m that answer is a coin toss. High
 * is ~10 m and costs battery, which is the right way round for a screen someone
 * opens when water is rising.
 */

/**
 * One reading, before it becomes a `UserPosition`.
 *
 * Deliberately without `locality`: naming the place is a separate, slower,
 * network-dependent question (`describePlace` below), and a fix must be usable
 * the instant it arrives rather than waiting on a geocoder that may never answer.
 */
export interface DeviceFix {
  latitude: number;
  longitude: number;
  accuracyMetres: number;
  takenAt: string;
}

/** What happened when we asked. Drives what Settings is able to offer. */
export type LocationPermission = 'pending' | 'granted' | 'denied';

export interface PositionWatch {
  remove: () => void;
}

/**
 * A fix we are willing to act on, or null.
 *
 * The accuracy check is the whole function. `LocationObjectCoords.accuracy` is
 * typed `number | null`, and a fix that cannot say how wrong it might be is not
 * usable for deciding whether somebody is inside a polygon — the map draws the
 * uncertainty ring at true scale and ZoneStatus prints the number, so there is
 * nowhere honest to put "unknown". Android always reports accuracy, so on this
 * app's target this never returns null; it exists so that the platforms which can
 * omit it degrade to the stated position instead of to a fabricated precision.
 */
function usable(reading: Location.LocationObject): DeviceFix | null {
  const { latitude, longitude, accuracy } = reading.coords;
  if (accuracy === null || !Number.isFinite(accuracy)) return null;
  return {
    latitude,
    longitude,
    accuracyMetres: Math.round(accuracy),
    takenAt: new Date(reading.timestamp).toISOString(),
  };
}

/**
 * Ask once, then keep reporting.
 *
 * Resolves as soon as the permission answer is known — not when the first fix
 * arrives, which on a cold GPS can be tens of seconds. Callers get the answer
 * they need to render immediately and the fixes as they come.
 *
 * `getLastKnownPositionAsync` is consulted first because it returns whatever the
 * platform already had, usually instantly. A minute-old fix from another app is a
 * far better opening frame than the stated position, and `watchPositionAsync`
 * overwrites it as soon as it has something of its own.
 */
export async function startPositionWatch(
  onFix: (fix: DeviceFix) => void,
): Promise<{ permission: LocationPermission; watch: PositionWatch }> {
  const inert: PositionWatch = { remove: () => {} };

  let granted = false;
  try {
    const response = await Location.requestForegroundPermissionsAsync();
    granted = response.granted;
  } catch {
    // Undocumented as a throw, but this is the one call in the app that depends
    // on a permission dialog the OS may decline to show at all — a build whose
    // manifest is missing ACCESS_FINE_LOCATION reaches exactly here.
    return { permission: 'denied', watch: inert };
  }

  if (!granted) return { permission: 'denied', watch: inert };

  try {
    const last = await Location.getLastKnownPositionAsync({
      // Half an hour. Older than that and the phone may well have moved wards
      // since, and a stale opening frame on this app is a map centred on the
      // wrong neighbourhood.
      maxAge: 30 * 60 * 1000,
      requiredAccuracy: 250,
    });
    if (last) {
      const fix = usable(last);
      if (fix) onFix(fix);
    }
  } catch {
    // A missing cached fix is the normal case on a phone that has just booted.
  }

  try {
    const subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        // 20 m of movement, or 10 s, whichever comes first. Tight enough that
        // walking out of a zone updates the card before you reach the corner,
        // loose enough that standing still does not respin the GPS.
        distanceInterval: 20,
        timeInterval: 10_000,
      },
      (reading) => {
        const fix = usable(reading);
        if (fix) onFix(fix);
      },
      // The error handler receives a plain string, per the docs. Swallowed: the
      // caller already knows what to do without a fix, and there is no screen
      // where a raw platform location error is the most useful thing to say.
      () => {},
    );
    return { permission: 'granted', watch: subscription };
  } catch {
    return { permission: 'granted', watch: inert };
  }
}

/**
 * A place name for a pair of coordinates, or null.
 *
 * The locality is not decoration — it is interpolated into "Nothing is affecting
 * {locality} right now" and into the SOS payload a control room reads, so it has
 * to be the name a person would use, not a street address.
 *
 * `district` first because that is what Kolkata addresses and ward notices use,
 * then `subregion`, then `city`. `name` is deliberately last: on Android it is
 * often a house number, and "Nothing is affecting 41B right now" is worse than
 * saying nothing.
 *
 * Returns null on failure of any kind. The docs warn this call is expensive, that
 * concurrent requests can error, and on Android it needs the foreground
 * permission we have already obtained plus a working network — which during a
 * flood is exactly what is missing. Every caller therefore has to have a plan for
 * null, and the fix itself is never held up waiting for this.
 */
export async function describePlace(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return null;
    const named =
      place.district ?? place.subregion ?? place.city ?? place.name ?? null;
    if (!named) return null;
    // The city as a qualifier when the first field was narrower than it. A ward
    // name alone is ambiguous on a screenshot sent to a relative in another
    // district.
    return place.city && named !== place.city ? `${named}, ${place.city}` : named;
  } catch {
    return null;
  }
}
