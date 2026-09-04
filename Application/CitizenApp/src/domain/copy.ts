import { adcToPercent, formatDistance } from './geo';
import type { HouseholdNeeds, ShelterChoice } from './shelter';
import type { Trend, TrendField } from './trend';
import type { AlertWithContext, Hazard, Reading, Severity, Shelter } from './types';

/**
 * The copy layer.
 *
 * The database `message` column is written for operators: "Critical water level:
 * 3100/4095 — possible flooding." A citizen should never be shown an ADC count
 * and an em-dash. These functions turn a row into something a frightened person
 * can read once and act on, and they keep that wording in one place so the feed,
 * the detail screen and the notification cannot disagree.
 */

/** The headline: what is happening, and where. Short enough not to wrap twice. */
export function headline(alert: AlertWithContext): string {
  const place = placeName(alert);
  if (alert.hazard_type === 'flood') {
    switch (alert.severity) {
      case 'critical':
        return `Water rising fast in ${place}`;
      case 'high':
        return `Flooding likely in ${place}`;
      case 'medium':
        return `Water levels climbing in ${place}`;
      case 'low':
        return `Heavy rain in ${place}`;
    }
  }
  switch (alert.severity) {
    case 'critical':
      return `Fire spreading near ${place}`;
    case 'high':
      return `Fire detected near ${place}`;
    case 'medium':
      return `Fire risk high near ${place}`;
    case 'low':
      return `Dry conditions near ${place}`;
  }
}

/**
 * Where the alert is, in the words people actually use. Sensor node names are
 * internal ("Sundarbans Edge Alpha"); the landmark inside them is not.
 */
function placeName(alert: AlertWithContext): string {
  const name = alert.node.name;
  if (name.startsWith('Sundarbans')) return 'the Sundarbans edge';
  if (name.startsWith('Rabindra Sarobar')) return 'Rabindra Sarobar';
  if (name.startsWith('Howrah Bridge')) return 'Howrah Bridge';
  if (name.startsWith('Salt Lake')) return 'Salt Lake';
  if (name.startsWith('New Town')) return 'New Town';
  if (name.startsWith('Jadavpur')) return 'Jadavpur';
  return name;
}

/**
 * One line on how near this is and how much it concerns the reader. Severity
 * ranks the feed, but proximity is what decides whether it is your problem.
 */
export function proximity(alert: AlertWithContext): string {
  const d = formatDistance(alert.distanceMetres);
  if (alert.distanceMetres < 600) return `${d} away, in your area`;
  if (alert.distanceMetres < 3000) return `${d} away`;
  return `${d} away, not in your area`;
}

/**
 * The evidence behind the warning, in plain units.
 *
 * Shown because an alert a person does not believe is an alert a person ignores.
 * The raw ADC count is included after the percentage for anyone who wants it.
 */
export function evidence(reading: Reading, hazard: Hazard): string[] {
  const lines: string[] = [];
  if (hazard === 'flood') {
    if (reading.water_level !== null) {
      lines.push(
        `Water sensor is at ${adcToPercent(reading.water_level)}% of full scale (${reading.water_level} of 4095).`,
      );
    }
    if (reading.rain_level !== null) {
      lines.push(`Rainfall sensor is at ${adcToPercent(reading.rain_level)}%.`);
    }
    if (reading.humidity !== null) {
      lines.push(`Humidity is ${reading.humidity.toFixed(0)}%.`);
    }
    return lines;
  }
  if (reading.flame_detected) lines.push('The flame sensor is triggered.');
  if (reading.temperature !== null) {
    lines.push(`Temperature is ${reading.temperature.toFixed(1)}°C.`);
  }
  if (reading.smoke_level !== null) {
    lines.push(
      `Smoke sensor is at ${adcToPercent(reading.smoke_level)}% of full scale (${reading.smoke_level} of 4095).`,
    );
  }
  return lines;
}

/**
 * Why this shelter and not another one.
 *
 * `people` is the household size, and it comes first in the order below for one
 * reason: a hall that cannot take everybody is the only thing here that changes
 * what a family should do, and burying it under "on higher ground" would be
 * choosing the more reassuring sentence over the more useful one.
 */
export function shelterReason(
  shelter: Shelter,
  hazard: Hazard,
  isNearest: boolean,
  people: number = 1,
): string {
  if (shelter.status === 'full') return 'At capacity. Do not go here.';
  if (shelter.status === 'closed') return 'Closed. Do not go here.';

  const free = shelter.capacity - shelter.occupancy;
  if (people > 1 && free < people) {
    return `Only ${free} ${free === 1 ? 'place' : 'places'} free — not enough for all ${people} of you.`;
  }
  if (hazard === 'flood' && shelter.elevation_metres >= 7.5) {
    return `On higher ground, ${shelter.elevation_metres.toFixed(1)} m above the local datum.`;
  }
  if (isNearest) return 'The closest shelter still taking people.';
  if (people > 1) return `Room for all ${people} of you, ${free} places free.`;
  return `${free} places free.`;
}

/**
 * What the recommendation cost, in one line, or null when it cost nothing.
 *
 * Shown beside the shelter rather than folded into `shelterReason`, because these
 * are not reasons to go — they are the reservations a person is owed before they
 * set out. Silence here means the app found a hall with room for everyone, close
 * enough to walk, with the care the household said it needed.
 */
export function shelterCaveat(
  choice: ShelterChoice,
  needs: HouseholdNeeds,
): string | null {
  if (!choice.fitsAll) {
    return `No open shelter has room for all ${needs.people} of you. This is the best of them, with ${choice.placesFree} ${choice.placesFree === 1 ? 'place' : 'places'} free — go together and ask at the desk.`;
  }
  if (!choice.walkable) {
    return `This is the nearest shelter with room for ${needs.people}, but it is a long walk. Ask for a lift or a boat if you can.`;
  }
  if (needs.wantsMedical && !choice.medical) {
    return 'No medical desk here. Bring any medicines you or the people with you take daily.';
  }
  return null;
}

/**
 * The advice that changes because of who is in the house.
 *
 * Only the non-swimmer line so far, and it earns its place: half a metre of
 * moving water takes an adult off their feet, which is knee-deep and looks
 * walkable from a doorway. Somebody who ticked that box on the form should be
 * told, not left to judge a current by eye.
 */
export function householdCaution(
  needs: HouseholdNeeds,
  hazard: Hazard,
): string | null {
  if (hazard !== 'flood' || !needs.avoidsWater) return null;
  return 'Somebody in your house cannot swim. Do not wade, however short the stretch looks — half a metre of moving water takes an adult off their feet.';
}

/**
 * Who wrote the directions on screen.
 *
 * Stated because the two are not equally trustworthy and the reader is the one
 * taking the risk. A surveyed route carries local knowledge — 006_citizen_tables
 * has a step that says take the footbridge rather than the rail underpass, which
 * no road graph encodes — and a generated one carries only what a map knows about
 * a street, which does not include the water on it an hour ago.
 *
 * Neither line apologises and neither boasts. A machine route that goes around
 * every marked zone is a good route, and saying nobody has walked it is not a
 * disclaimer, it is the one fact that decides whether to believe the phone or your
 * own eyes at a junction.
 */
export function routeSource(source: 'surveyed' | 'generated'): string {
  return source === 'surveyed'
    ? 'Surveyed on foot by the ward office.'
    : 'Worked out from a street map, routed around the marked zones. Nobody has walked it, so trust your eyes at every turn.';
}



/**
 * Which way the sensor is going, in a sentence.
 *
 * Percentages of the sensor's range, not centimetres — domain/trend.ts explains
 * why at length, and the short version is that this project has no calibration
 * against a staff gauge and a fabricated depth is the one number here somebody
 * would plan around.
 */
export function trendSentence(trend: Trend, field: TrendField): string {
  const what = TREND_LABEL[field];
  const span = overMinutes(trend.spanMinutes);
  const from = trend.series[0];

  if (trend.direction === 'steady') {
    return `Holding steady. The ${what} sensor has sat near ${trend.latest}% of its range for the last ${span}.`;
  }
  const verb = trend.direction === 'rising' ? 'Still rising' : 'Falling back';
  return `${verb}. The ${what} sensor has gone from ${from}% to ${trend.latest}% of its range in the last ${span}.`;
}

/**
 * The rate, stated only when it is fast enough to decide something.
 *
 * A gentle slope does not need a number attached — the sentence above already
 * says which way it is going, and "up 1 point an hour" invites somebody to do
 * arithmetic about a sensor's range instead of looking out of the window.
 */
export function trendRate(trend: Trend): string | null {
  if (trend.direction !== 'rising' || trend.pointsPerHour < 5) return null;
  return `At this rate that is ${trend.pointsPerHour} more points of range every hour.`;
}

const TREND_LABEL: Record<TrendField, string> = {
  water_level: 'water',
  rain_level: 'rainfall',
  smoke_level: 'smoke',
};

/** A duration somebody can hold in their head. */
export function overMinutes(minutes: number): string {
  if (minutes < 90) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function occupancyLine(shelter: Shelter): string {
  const free = shelter.capacity - shelter.occupancy;
  if (shelter.status === 'full') return `Full, ${shelter.capacity} people inside`;
  if (free < 30) return `Nearly full, ${free} places left`;
  return `${free} of ${shelter.capacity} places free`;
}

/** Severity as a sentence, for screen readers and the takeover screen. */
export function spokenSeverity(severity: Severity, hazard: Hazard): string {
  const what = hazard === 'flood' ? 'Flood' : 'Fire';
  switch (severity) {
    case 'critical':
      return `${what} warning, critical. Leave now.`;
    case 'high':
      return `${what} warning, high. Move to a shelter.`;
    case 'medium':
      return `${what} watch, medium. Get ready.`;
    case 'low':
      return `${what} notice, low. Stay aware.`;
  }
}
