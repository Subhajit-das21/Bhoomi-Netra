import type {
  Hazard,
  HouseholdProfile,
  Shelter,
  ShelterWithRoute,
} from './types';

/**
 * Which shelter to send this household to, and what it had to give up.
 *
 * This was three lines inside CitizenProvider and it was wrong in a way nobody
 * would notice on screen: it ranked by distance and elevation and would happily
 * send a family of seven to a hall with four places left. Splitting a household
 * at the door of a shelter, in the dark, in water, is how children end up in a
 * different building from their parents — and the app had every number it needed
 * to avoid it except one, which is why the household questions exist.
 *
 * It lives here rather than in the provider because it is the one piece of
 * reasoning in this app that is worth asserting against by hand. `chooseShelter`
 * is pure, and scripts/check-domain.js runs it over the seeded roster from
 * 006_citizen_tables.sql, including the cases a real district hits — every hall
 * full, nothing within walking distance, no profile at all.
 *
 * ------------------------------------------------------------------
 * It reports its compromises rather than hiding them
 * ------------------------------------------------------------------
 * The honest answer is often "the best I can do is not good enough". When no
 * reachable shelter has room for everyone, the right behaviour is not to fall
 * silently back to the nearest one — it is to name the nearest one *and say it
 * does not have room*, so the household can decide to split deliberately or walk
 * further. `ShelterChoice` carries that verdict so the copy layer cannot forget
 * to mention it.
 */

/**
 * Anything beyond this is too far to walk to in a flood.
 *
 * 2.5 km is roughly thirty-five minutes at the pace walkMinutes() assumes, and
 * that is already optimistic for somebody carrying a child through knee-deep
 * water. It is a preference, not a wall: a shelter past it is still offered when
 * there is nothing closer, because the alternative is offering nothing.
 */
export const WALKABLE_LIMIT_M = 2500;

/**
 * What a metre of extra ground is worth in metres of extra walking, in a flood.
 *
 * This number has to exist. Without it, "prefer higher ground" and "prefer the
 * nearer hall" are two rules with nothing to say about which of them wins, and
 * the first version of this file resolved that by putting elevation first — which
 * sent a lone adult 1.6 km across Ward 58 to gain 70 cm of datum. Every extra
 * minute in moving water is what that trade is spending, so the rate is
 * deliberately stingy: 300 m of walking, about four minutes, per metre risen.
 *
 * On the seeded roster it answers the way a ward officer would. Deshapriya at
 * 395 m and 7.5 m keeps a household, because Jadavpur's extra 0.7 m does not pay
 * for 1.5 km more wading; raise Jadavpur past about 12.7 m and it wins, because
 * five metres of real rise does.
 */
const METRES_WALKED_PER_METRE_RISEN = 300;

/** What the household needs from a shelter, reduced to what can be acted on. */
export interface HouseholdNeeds {
  /** How many places must be free. At least one, even with no profile. */
  people: number;
  /** Somebody here should not be sent to a hall with no medical desk. */
  wantsMedical: boolean;
  /**
   * Somebody here cannot swim. Not used for ranking — see the note in `better` —
   * but it changes the walking advice, which is the one place it can help.
   */
  avoidsWater: boolean;
}

/**
 * The recommendation, with its compromises attached.
 *
 * Every flag is about *this* household, which is why they are not on `Shelter`:
 * the same hall with 40 places free fits a family of four and does not fit a
 * joint household of forty-two, and the shelter row cannot know which it is
 * looking at.
 */
export interface ShelterChoice {
  shelter: ShelterWithRoute;
  /** Free places are enough for everyone in the house. */
  fitsAll: boolean;
  /** Within WALKABLE_LIMIT_M on foot. */
  walkable: boolean;
  /** Has a medical desk, and this household wanted one. */
  medical: boolean;
  /** How many places were free when the roster was last fetched. */
  placesFree: number;
}

/**
 * The profile reduced to the three things shelter choice can act on.
 *
 * A null profile is a household of one with no stated needs — the same thing the
 * app assumed before it asked, so declining the questions changes nothing about
 * how this behaves rather than degrading it.
 */
export function needsOf(profile: HouseholdProfile | null): HouseholdNeeds {
  if (!profile) return { people: 1, wantsMedical: false, avoidsWater: false };
  return {
    people: Math.max(1, profile.people),
    // Pregnancy, infants, age and anyone who cannot leave unaided all argue for
    // a hall with a medical desk. They are summed rather than checked one by one
    // because the answer to "does this household want medical care nearby" is
    // yes if any of them is above zero.
    wantsMedical:
      profile.pregnant + profile.infants + profile.elderly + profile.needs_assistance > 0,
    avoidsWater: profile.non_swimmers > 0,
  };
}

/**
 * Whether a shelter has medical care on site.
 *
 * Matched on the word rather than an exact string. `facilities` is a free-text
 * array a district authority types into, and 'Medical desk', 'Medical post' and
 * 'Medical camp' are all the same fact — an exact match on the one value the
 * seed data happens to use would silently stop working the first time somebody
 * in a district office phrased it differently.
 */
export function hasMedical(shelter: Shelter): boolean {
  return shelter.facilities.some((f) => /medic|doctor|nurs|first aid/i.test(f));
}

export function placesFree(shelter: Shelter): number {
  return Math.max(0, shelter.capacity - shelter.occupancy);
}

/**
 * Pick a shelter for this household.
 *
 * Filters widen in order of what it costs the household to give up, and the
 * order is the argument:
 *
 *   1. room for everyone, close enough to walk    — what we want
 *   2. room for everyone, further than we'd like  — a longer walk beats splitting up
 *   3. close enough to walk, not enough room      — when nothing has room, closest wins
 *   4. any open shelter at all                    — 8 km away is still information
 *
 * Two is above three deliberately. A household that arrives together and is
 * turned away has to walk twice, in worse conditions, having already been told
 * where to go; a household told up front that the near hall is short of places
 * can choose. Neither is good, and the second is recoverable.
 *
 * Returns null only when the district has published no open shelter, which is a
 * real state — every hall full is what a bad night looks like — and the screens
 * say so rather than showing an empty card.
 */
export function chooseShelter(
  shelters: ShelterWithRoute[],
  needs: HouseholdNeeds,
  hazard: Hazard,
): ShelterChoice | null {
  const open = shelters.filter((s) => s.status === 'open');
  if (open.length === 0) return null;

  const fits = (s: ShelterWithRoute) => placesFree(s) >= needs.people;
  const near = (s: ShelterWithRoute) => s.distanceMetres <= WALKABLE_LIMIT_M;

  const pool =
    nonEmpty(open.filter((s) => fits(s) && near(s))) ??
    nonEmpty(open.filter(fits)) ??
    nonEmpty(open.filter(near)) ??
    open;

  const shelter = pool.reduce((best, s) =>
    better(s, best, needs, hazard) ? s : best,
  );

  return {
    shelter,
    fitsAll: fits(shelter),
    walkable: near(shelter),
    medical: needs.wantsMedical && hasMedical(shelter),
    placesFree: placesFree(shelter),
  };
}

/**
 * Whether `a` is a better shelter than `b`, within a pool that has already
 * agreed on room and reach.
 *
 * Medical care is lexicographic and everything else is one number, and the split
 * is the design. There is no honest answer to "how many metres of walking is a
 * medical desk worth" — a hall with a doctor is what a household with a newborn
 * needs, full stop — so that comparison stays a yes or no. Elevation against
 * distance is the opposite: both are metres, both are the same kind of risk, and
 * pretending they cannot be traded is what produced the 1.6 km detour for 70 cm.
 *
 * Keeping the rest scalar also makes this a real ordering. A chain of
 * "close enough to ignore" elevation comparisons is not transitive — 7.0 ties
 * 7.4, 7.4 ties 7.9, and 7.9 beats 7.0 — so the winner depended on the order the
 * roster arrived in. `walkingCost` cannot do that.
 */
function better(
  a: ShelterWithRoute,
  b: ShelterWithRoute,
  needs: HouseholdNeeds,
  hazard: Hazard,
): boolean {
  if (needs.wantsMedical) {
    const am = hasMedical(a);
    if (am !== hasMedical(b)) return am;
  }

  // `needs.avoidsWater` deliberately does not appear here. It reads as though it
  // should prefer a shelter with `routeCrossesRisk` false — but that flag is true
  // when the user is inside a zone and the shelter is outside it, so honouring it
  // would prefer the hall *inside* the flood zone for the household least able to
  // survive being wrong about that. It belongs in the advice copy, which tells a
  // non-swimmer not to wade whichever shelter they are walking to.
  const ac = walkingCost(a, hazard);
  const bc = walkingCost(b, hazard);
  if (ac !== bc) return ac < bc;

  // Equal on every count that matters. Break the tie on id so the same roster
  // always produces the same recommendation — a shelter that changes between two
  // renders would make the map's marks flicker and the copy contradict itself.
  return a.id < b.id;
}

/**
 * The walk to a shelter in metres, discounted by the ground it stands on.
 *
 * The discount applies only in a flood. Elevation is the whole game when water is
 * rising and completely beside the point when the hazard is fire, where it would
 * just be an arbitrary tie-break sending people uphill for no reason.
 *
 * Absolute elevation rather than a difference from the roster's lowest, which
 * means the number is negative for most halls in Kolkata. That is fine — only its
 * ordering is ever read, and subtracting a roster minimum would make one
 * shelter's rank depend on which other shelters were fetched.
 */
function walkingCost(shelter: ShelterWithRoute, hazard: Hazard): number {
  if (hazard !== 'flood') return shelter.distanceMetres;
  return (
    shelter.distanceMetres -
    shelter.elevation_metres * METRES_WALKED_PER_METRE_RISEN
  );
}

function nonEmpty<T>(list: T[]): T[] | null {
  return list.length > 0 ? list : null;
}
