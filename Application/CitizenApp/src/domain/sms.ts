import { coordinateLabel } from './geo';
import type { HouseholdProfile, RiskZone, UserPosition } from './types';

/**
 * The words of the SOS text message.
 *
 * In `domain/` rather than beside `services/sms.ts` for the reason everything
 * else here is: it touches no platform API, so it can be asserted in plain Node
 * by scripts/check-domain.js. The one thing on this screen whose exact wording a
 * rescue coordinator has to act on is the one thing that would otherwise be
 * untestable, which is the wrong way round.
 */

/**
 * Kept short enough to survive one or two SMS segments without being cut.
 *
 * A GSM-7 segment is 160 characters, and concatenation costs 7 of them per part,
 * so 300 is comfortably two. It matters because a truncated message loses its
 * tail, and the tail is where the address is.
 */
export const MAX_SMS_CHARS = 300;

/**
 * The message a rescue coordinator can act on without replying to ask anything.
 *
 * Ordered by what gets somebody into a boat: where, how many, who cannot get
 * themselves out, then the address in words. Coordinates first because they are
 * the only part that works when the address is a lane with no name on any map,
 * and four decimal places is about 11 m — finer than the fix itself, which is why
 * the accuracy is stated next to it rather than implied.
 */
export function emergencySmsBody(
  position: UserPosition,
  profile: HouseholdProfile | null,
  zone: RiskZone | null,
): string {
  const lines: string[] = ['HELP NEEDED — BHOOMI-NETRA'];

  /**
   * The coordinates, then whatever words we have for them — and only if they are
   * words.
   *
   * `locality` falls back to exactly `coordinateLabel` when the reverse geocoder
   * could not name the place, so it is compared rather than blindly prefixed.
   * "22.5148, 88.3610 at 22.5148,88.3610" would spend a fifth of a segment saying
   * one thing twice, and it is the tail of this message that gets cut.
   */
  const fix = `${position.latitude.toFixed(4)},${position.longitude.toFixed(4)}`;
  const named =
    position.locality === coordinateLabel(position) ? null : position.locality;
  const where = [named, profile?.ward ? `ward ${profile.ward}` : null]
    .filter((part): part is string => part !== null)
    .join(', ');
  lines.push(
    where
      ? `${where} at ${fix} (approx ${position.accuracyMetres} m)`
      : `${fix} (approx ${position.accuracyMetres} m)`,
  );

  if (profile) {
    lines.push(`${profile.people} ${profile.people === 1 ? 'person' : 'people'}`);

    // Only the counts above zero. Somebody reading this on a handset in a control
    // room should not have to skim past four zeroes to find the one that matters.
    const assisted = [
      [profile.elderly, 'elderly'],
      [profile.infants, profile.infants === 1 ? 'infant' : 'infants'],
      [profile.pregnant, 'pregnant'],
      [profile.needs_assistance, 'cannot move unaided'],
      [profile.non_swimmers, 'cannot swim'],
    ] as const;
    const needs = assisted
      .filter(([count]) => count > 0)
      .map(([count, label]) => `${count} ${label}`);
    if (needs.length > 0) lines.push(`Needs help: ${needs.join(', ')}`);

    if (profile.address) lines.push(profile.address);
    if (profile.contact_name) lines.push(`Contact: ${profile.contact_name}`);
    if (profile.livestock) lines.push(`Livestock: ${profile.livestock}`);
  } else {
    // No profile is an ordinary state — every question is skippable — and the
    // message still has to be worth sending. It says what it does not know rather
    // than leaving a coordinator to assume one adult who can swim.
    lines.push('Household size not recorded');
  }

  if (zone) lines.push(`In ${zone.name} (${zone.severity} ${zone.hazard_type})`);

  return truncate(lines.join('\n'), MAX_SMS_CHARS);
}

/**
 * Cut on a line boundary where possible, so a message never ends mid-number.
 *
 * Half the limit is the floor for that courtesy: below it the last newline is so
 * far back that honouring it would drop more than it saves, and a hard cut at the
 * limit keeps more of the message.
 */
function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const cut = text.lastIndexOf('\n', limit);
  return text.slice(0, cut > limit / 2 ? cut : limit);
}
