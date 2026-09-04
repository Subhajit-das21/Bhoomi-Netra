import { callRpc } from '../services/supabase';
import type {
  HouseholdProfile,
  Language,
  Tenure,
} from '../domain/types';

/**
 * The three household calls, and the row → domain mapping for each.
 *
 * Sibling to queries.ts and the same idea, with one difference worth naming: every
 * read in queries.ts goes to a table or a view, and nothing here does. The
 * `households` table grants the anon role no privileges at all, so there is no
 * `GET /households` to write — see the threat-model note at the top of
 * 007_households.sql. All three calls below are functions that take one device id
 * and can reach at most one row.
 */

/** What `restore_household` returns, one row at most. */
interface HouseholdRow {
  language: Language | null;
  contact_name: string | null;
  ward: string | null;
  address: string | null;
  people: number | null;
  tenure: Tenure | null;
  elderly: number | null;
  infants: number | null;
  pregnant: number | null;
  needs_assistance: number | null;
  non_swimmers: number | null;
  livestock: string | null;
  safe_at: string | null;
  updated_at: string;
}

export interface RestoredHousehold {
  profile: HouseholdProfile;
  /** The server's own stamp, so the prompt can say how old these answers are. */
  updated_at: string;
  safe_at: string | null;
}

/**
 * A profile with nothing answered.
 *
 * Exported because the onboarding flow starts from it and because `restore` maps
 * onto it: every column in 007 is nullable except `language` and `people`, and
 * spreading a partial row over this is what keeps eleven `?? default` expressions
 * out of the screens.
 */
export const EMPTY_PROFILE: HouseholdProfile = {
  language: 'en',
  contact_name: null,
  ward: null,
  address: null,
  people: 1,
  tenure: null,
  elderly: 0,
  infants: 0,
  pregnant: 0,
  needs_assistance: 0,
  non_swimmers: 0,
  livestock: null,
};

/**
 * Look for a profile saved under this device id.
 *
 * Null for "no row", which after a reinstall is the ordinary answer and not a
 * failure. A network or server problem throws instead, because those two cases
 * lead to different screens: one offers the old details back, the other must not
 * claim there were none.
 */
export async function restoreHousehold(
  deviceId: string,
): Promise<RestoredHousehold | null> {
  const rows = await callRpc<HouseholdRow[] | null>('restore_household', {
    p_device_id: deviceId,
  });

  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  return {
    profile: {
      language: row.language ?? 'en',
      contact_name: row.contact_name,
      ward: row.ward,
      address: row.address,
      // Columns declared NOT NULL DEFAULT, so these coalesces are for the case
      // where someone loosens that later. A null `people` must not become NaN in
      // the shelter-capacity comparison it exists to feed.
      people: row.people ?? 1,
      tenure: row.tenure,
      elderly: row.elderly ?? 0,
      infants: row.infants ?? 0,
      pregnant: row.pregnant ?? 0,
      needs_assistance: row.needs_assistance ?? 0,
      non_swimmers: row.non_swimmers ?? 0,
      livestock: row.livestock,
    },
    updated_at: row.updated_at,
    safe_at: row.safe_at,
  };
}

/**
 * Save, whether or not there was already a row.
 *
 * One call for create and update, because after a reinstall the handset does not
 * know which one it is doing and should not have to. The function upserts on
 * `device_id`, so the only row it can write is this one's.
 *
 * Returns the server's `updated_at`, which is deliberately what gets cached
 * alongside the answers: two clocks disagreeing about when a profile was last
 * confirmed is how a retention policy deletes something it should have kept.
 *
 * Empty strings are sent as null. Somebody who clears a field means "I am not
 * answering that", and storing '' would make `address IS NOT NULL` true for a
 * household with no address — a control room would read that as an address it
 * simply failed to display.
 */
export async function saveHousehold(
  deviceId: string,
  profile: HouseholdProfile,
): Promise<string> {
  return callRpc<string>('update_household', {
    p_device_id: deviceId,
    p_language: profile.language,
    p_contact_name: blankToNull(profile.contact_name),
    p_ward: blankToNull(profile.ward),
    p_address: blankToNull(profile.address),
    p_people: profile.people,
    p_tenure: profile.tenure,
    p_elderly: profile.elderly,
    p_infants: profile.infants,
    p_pregnant: profile.pregnant,
    p_needs_assistance: profile.needs_assistance,
    p_non_swimmers: profile.non_swimmers,
    p_livestock: blankToNull(profile.livestock),
  });
}

/**
 * Report in, or take it back.
 *
 * Not called yet, and named here rather than omitted because it is the third of
 * the three doors 007 opens and the reason `safe_at` is read above: the roll-call
 * screen that calls it is the next piece of work, and a data layer that covered
 * two of the three functions would read as an oversight rather than a sequence.
 *
 * Passing `safe: false` clears the flag and the position with it, because water
 * rises again and a household that sheltered upstairs at noon can need a boat by
 * evening.
 *
 * Throws when there is no row for this device — the function raises rather than
 * creating one, and it is right to: a "we are safe" ping with no address adds a
 * line to a list of unknowns instead of removing one from a search list. The
 * screen will have to say so rather than let the tap look like it landed.
 *
 * Resolves to the server's `safe_at`, or null when the flag was just cleared.
 */
export async function markHouseholdSafe(
  deviceId: string,
  safe: boolean,
  at: { latitude: number; longitude: number } | null,
): Promise<string | null> {
  return callRpc<string | null>('mark_household_safe', {
    p_device_id: deviceId,
    p_safe: safe,
    p_latitude: safe ? at?.latitude ?? null : null,
    p_longitude: safe ? at?.longitude ?? null : null,
  });
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
