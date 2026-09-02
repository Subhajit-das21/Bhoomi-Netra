import type { UserPosition } from '../domain/types';

/**
 * Where the app believes the user is.
 *
 * A fixed position, and the one piece of data in this app that is still local by
 * necessity rather than by choice. `expo-location` is not installed and the npm
 * registry is unreachable from this environment, so there is no way to ask the
 * device. Everything downstream — which zone you are standing in, which shelter
 * is recommended, the bearing on the direction card, the SOS payload — is
 * computed from this one value, so it is stated here once instead of being
 * scattered.
 *
 * Ward 58, between Kalighat and Rabindra Sarobar, inside the critical flood zone
 * seeded in 006_citizen_tables.sql. Chosen so the app's hardest states are the
 * ones you see first: standing inside a critical zone is what triggers the
 * takeover, and it is the case that has to be right.
 *
 * ------------------------------------------------------------------
 * The seam
 * ------------------------------------------------------------------
 * Replacing this is a contained change. `expo install expo-location`, then have
 * `CitizenProvider` hold position in state and update it from
 * `Location.watchPositionAsync`. `accuracyMetres` and `takenAt` already exist and
 * are already shown to the user — the map draws the accuracy ring at true scale
 * and the header says how old the fix is — so a real GPS feed has somewhere
 * honest to report to on arrival, including when it is a bad fix.
 */
export const DEVICE_POSITION: UserPosition = {
  latitude: 22.5148,
  longitude: 88.361,
  accuracyMetres: 18,
  takenAt: new Date().toISOString(),
  locality: 'Ward 58, Kolkata',
};
