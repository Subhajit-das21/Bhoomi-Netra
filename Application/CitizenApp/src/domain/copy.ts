import { adcToPercent, formatDistance } from './geo';
import { t } from './i18n';
import type { HouseholdNeeds, ShelterChoice } from './shelter';
import type { Trend, TrendField } from './trend';
import type {
  AlertWithContext,
  Hazard,
  Language,
  Reading,
  Severity,
  Shelter,
} from './types';

/**
 * The copy layer.
 *
 * The database `message` column is written for operators: "Critical water level:
 * 3100/4095 — possible flooding." A citizen should never be shown an ADC count
 * and an em-dash. These functions turn a row into something a frightened person
 * can read once and act on, and they keep that wording in one place so the feed,
 * the detail screen and the notification cannot disagree.
 *
 * Because the wording lives here rather than in the database, translating it is a
 * dictionary and not a schema change — every sentence a citizen reads on the
 * critical path is generated on the device. `lang` defaults to English on each
 * function so a caller that has no household profile still gets a sentence, and so
 * that an untranslated screen is a screen that has not passed one yet rather than
 * a screen that crashes.
 */

/** The headline: what is happening, and where. Short enough not to wrap twice. */
export function headline(
  alert: AlertWithContext,
  lang: Language = 'en',
): string {
  const place = placeName(alert, lang);
  if (alert.hazard_type === 'flood') {
    switch (alert.severity) {
      case 'critical':
        return t(lang, 'Water rising fast in {place}', { place });
      case 'high':
        return t(lang, 'Flooding likely in {place}', { place });
      case 'medium':
        return t(lang, 'Water levels climbing in {place}', { place });
      case 'low':
        return t(lang, 'Heavy rain in {place}', { place });
    }
  }
  switch (alert.severity) {
    case 'critical':
      return t(lang, 'Fire spreading near {place}', { place });
    case 'high':
      return t(lang, 'Fire detected near {place}', { place });
    case 'medium':
      return t(lang, 'Fire risk high near {place}', { place });
    case 'low':
      return t(lang, 'Dry conditions near {place}', { place });
  }
}

/**
 * Where the alert is, in the words people actually use. Sensor node names are
 * internal ("Sundarbans Edge Alpha"); the landmark inside them is not.
 *
 * The landmarks are transliterated rather than translated, and a name with no
 * entry in the dictionary is passed through in the Latin script it arrived in.
 * That is the right failure: a reader standing at a junction has to match what
 * the phone says to what the road sign says.
 */
function placeName(alert: AlertWithContext, lang: Language): string {
  const name = alert.node.name;
  if (name.startsWith('Sundarbans')) return t(lang, 'the Sundarbans edge');
  if (name.startsWith('Rabindra Sarobar')) return t(lang, 'Rabindra Sarobar');
  if (name.startsWith('Howrah Bridge')) return t(lang, 'Howrah Bridge');
  if (name.startsWith('Salt Lake')) return t(lang, 'Salt Lake');
  if (name.startsWith('New Town')) return t(lang, 'New Town');
  if (name.startsWith('Jadavpur')) return t(lang, 'Jadavpur');
  return name;
}

/**
 * One line on how near this is and how much it concerns the reader. Severity
 * ranks the feed, but proximity is what decides whether it is your problem.
 */
export function proximity(
  alert: AlertWithContext,
  lang: Language = 'en',
): string {
  const distance = formatDistance(alert.distanceMetres, lang);
  if (alert.distanceMetres < 600) {
    return t(lang, '{distance} away, in your area', { distance });
  }
  if (alert.distanceMetres < 3000) return t(lang, '{distance} away', { distance });
  return t(lang, '{distance} away, not in your area', { distance });
}

/**
 * The evidence behind the warning, in plain units.
 *
 * Shown because an alert a person does not believe is an alert a person ignores.
 * The raw ADC count is included after the percentage for anyone who wants it.
 */
export function evidence(
  reading: Reading,
  hazard: Hazard,
  lang: Language = 'en',
): string[] {
  const lines: string[] = [];
  if (hazard === 'flood') {
    if (reading.water_level !== null) {
      lines.push(
        t(lang, 'Water sensor is at {pct}% of full scale ({raw} of 4095).', {
          pct: adcToPercent(reading.water_level),
          raw: reading.water_level,
        }),
      );
    }
    if (reading.rain_level !== null) {
      lines.push(
        t(lang, 'Rainfall sensor is at {pct}%.', {
          pct: adcToPercent(reading.rain_level),
        }),
      );
    }
    if (reading.humidity !== null) {
      lines.push(
        t(lang, 'Humidity is {pct}%.', { pct: reading.humidity.toFixed(0) }),
      );
    }
    return lines;
  }
  if (reading.flame_detected) {
    lines.push(t(lang, 'The flame sensor is triggered.'));
  }
  if (reading.temperature !== null) {
    lines.push(
      t(lang, 'Temperature is {c}°C.', { c: reading.temperature.toFixed(1) }),
    );
  }
  if (reading.smoke_level !== null) {
    lines.push(
      t(lang, 'Smoke sensor is at {pct}% of full scale ({raw} of 4095).', {
        pct: adcToPercent(reading.smoke_level),
        raw: reading.smoke_level,
      }),
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
  lang: Language = 'en',
): string {
  if (shelter.status === 'full') return t(lang, 'At capacity. Do not go here.');
  if (shelter.status === 'closed') return t(lang, 'Closed. Do not go here.');

  const free = shelter.capacity - shelter.occupancy;
  if (people > 1 && free < people) {
    return t(
      lang,
      free === 1
        ? 'Only {free} place free — not enough for all {people} of you.'
        : 'Only {free} places free — not enough for all {people} of you.',
      { free, people },
    );
  }
  if (hazard === 'flood' && shelter.elevation_metres >= 7.5) {
    return t(lang, 'On higher ground, {metres} m above the local datum.', {
      metres: shelter.elevation_metres.toFixed(1),
    });
  }
  if (isNearest) return t(lang, 'The closest shelter still taking people.');
  if (people > 1) {
    return t(lang, 'Room for all {people} of you, {free} places free.', {
      people,
      free,
    });
  }
  return t(lang, '{free} places free.', { free });
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
  lang: Language = 'en',
): string | null {
  if (!choice.fitsAll) {
    return t(
      lang,
      choice.placesFree === 1
        ? 'No open shelter has room for all {people} of you. This is the best of them, with {free} place free — go together and ask at the desk.'
        : 'No open shelter has room for all {people} of you. This is the best of them, with {free} places free — go together and ask at the desk.',
      { people: needs.people, free: choice.placesFree },
    );
  }
  if (!choice.walkable) {
    return t(
      lang,
      'This is the nearest shelter with room for {people}, but it is a long walk. Ask for a lift or a boat if you can.',
      { people: needs.people },
    );
  }
  if (needs.wantsMedical && !choice.medical) {
    return t(
      lang,
      'No medical desk here. Bring any medicines you or the people with you take daily.',
    );
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
  lang: Language = 'en',
): string | null {
  if (hazard !== 'flood' || !needs.avoidsWater) return null;
  return t(
    lang,
    'Somebody in your house cannot swim. Do not wade, however short the stretch looks — half a metre of moving water takes an adult off their feet.',
  );
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
export function routeSource(
  source: 'surveyed' | 'generated',
  lang: Language = 'en',
): string {
  return source === 'surveyed'
    ? t(lang, 'Surveyed on foot by the ward office.')
    : t(
        lang,
        'Worked out from a street map, routed around the marked zones. Nobody has walked it, so trust your eyes at every turn.',
      );
}



/**
 * Which way the sensor is going, in a sentence.
 *
 * Percentages of the sensor's range, not centimetres — domain/trend.ts explains
 * why at length, and the short version is that this project has no calibration
 * against a staff gauge and a fabricated depth is the one number here somebody
 * would plan around.
 *
 * Three whole sentences rather than a verb interpolated into one. "Still rising"
 * and the clause after it are a single unit of grammar, and a template that joined
 * them would put a Bengali verb in the second position that Bengali wants last.
 */
export function trendSentence(
  trend: Trend,
  field: TrendField,
  lang: Language = 'en',
): string {
  const vars = {
    what: t(lang, TREND_LABEL[field]),
    span: overMinutes(trend.spanMinutes, lang),
    latest: trend.latest,
    from: trend.series[0],
  };

  if (trend.direction === 'steady') {
    return t(
      lang,
      'Holding steady. The {what} sensor has sat near {latest}% of its range for the last {span}.',
      vars,
    );
  }
  return t(
    lang,
    trend.direction === 'rising'
      ? 'Still rising. The {what} sensor has gone from {from}% to {latest}% of its range in the last {span}.'
      : 'Falling back. The {what} sensor has gone from {from}% to {latest}% of its range in the last {span}.',
    vars,
  );
}

/**
 * The rate, stated only when it is fast enough to decide something.
 *
 * A gentle slope does not need a number attached — the sentence above already
 * says which way it is going, and "up 1 point an hour" invites somebody to do
 * arithmetic about a sensor's range instead of looking out of the window.
 */
export function trendRate(trend: Trend, lang: Language = 'en'): string | null {
  if (trend.direction !== 'rising' || trend.pointsPerHour < 5) return null;
  return t(
    lang,
    'At this rate that is {points} more points of range every hour.',
    { points: trend.pointsPerHour },
  );
}

const TREND_LABEL: Record<TrendField, string> = {
  water_level: 'water',
  rain_level: 'rainfall',
  smoke_level: 'smoke',
};

/** A duration somebody can hold in their head. */
export function overMinutes(minutes: number, lang: Language = 'en'): string {
  if (minutes < 90) return t(lang, '{n} minutes', { n: minutes });
  const hours = Math.round(minutes / 60);
  return t(lang, hours === 1 ? '{n} hour' : '{n} hours', { n: hours });
}

export function occupancyLine(shelter: Shelter, lang: Language = 'en'): string {
  const free = shelter.capacity - shelter.occupancy;
  if (shelter.status === 'full') {
    return t(lang, 'Full, {capacity} people inside', {
      capacity: shelter.capacity,
    });
  }
  if (free < 30) return t(lang, 'Nearly full, {free} places left', { free });
  return t(lang, '{free} of {capacity} places free', {
    free,
    capacity: shelter.capacity,
  });
}

/** Severity as a sentence, for screen readers and the takeover screen. */
export function spokenSeverity(
  severity: Severity,
  hazard: Hazard,
  lang: Language = 'en',
): string {
  const vars = { hazard: t(lang, hazard === 'flood' ? 'Flood' : 'Fire') };
  switch (severity) {
    case 'critical':
      return t(lang, '{hazard} warning, critical. Leave now.', vars);
    case 'high':
      return t(lang, '{hazard} warning, high. Move to a shelter.', vars);
    case 'medium':
      return t(lang, '{hazard} watch, medium. Get ready.', vars);
    case 'low':
      return t(lang, '{hazard} notice, low. Stay aware.', vars);
  }
}
