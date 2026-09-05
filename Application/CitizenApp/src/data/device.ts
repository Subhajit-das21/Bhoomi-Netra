import type { UserPosition } from '../domain/types';

/**
 * Where the app assumes the user is until the device says otherwise.
 *
 * This used to be the only answer. It is now the opening frame and the fallback:
 * services/location.ts asks the platform, and CitizenProvider replaces this the
 * moment a fix with a known accuracy arrives. Three cases keep it on screen —
 * before the first fix lands, when location permission is refused, and on a build
 * whose manifest never asked for the permission at all.
 *
 * Ward 58, between Kalighat and Rabindra Sarobar, inside the critical flood zone
 * seeded in 006_citizen_tables.sql. Chosen so the app's hardest states are the
 * ones you see first: standing inside a critical zone is what triggers the
 * takeover, and it is the case that has to be right.
 *
 * ------------------------------------------------------------------
 * It is labelled, not disguised
 * ------------------------------------------------------------------
 * A stated position rendered as though it were a GPS fix is the most dangerous
 * thing this file could do: it would put "You are inside a critical flooding zone"
 * in front of somebody standing three wards away, or — worse in the other
 * direction — show an all-clear to somebody standing in the water. So
 * `positionSource` travels with it through the provider, Settings names which one
 * is in use, and ZoneStatus says the boundary answer is about an assumed location
 * rather than a measured one.
 *
 * `accuracyMetres` here is what a good urban fix looks like, and that is the
 * point of the label: the number is plausible, so nothing downstream can tell the
 * difference, so the difference has to be carried separately.
 *
 * On an emulator, expect a fix in Mountain View unless you set a location in the
 * extended controls — 22.5148, 88.3610 puts you back inside the seeded zone.
 */
export const DEVICE_POSITION: UserPosition = {
  latitude: 22.5148,
  longitude: 88.361,
  accuracyMetres: 18,
  takenAt: new Date().toISOString(),
  locality: 'Ward 58, Kolkata',
};
