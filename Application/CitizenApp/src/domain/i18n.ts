import type { Language } from './types';

/**
 * Bengali and Hindi, without a package.
 *
 * ------------------------------------------------------------------
 * The English string is the key
 * ------------------------------------------------------------------
 * There is no `alerts.takeover.title` here. A call reads
 * `t(lang, 'Move to higher ground now.')`, and the dictionary is keyed by that
 * exact sentence. Three things fall out of it, all of them worth more than a tidy
 * namespace:
 *
 *   The screens stay readable. The copy in this app *is* the design — a lot of
 *   argument went into "Nothing was sent — you let go early" — and replacing it
 *   with an identifier would move the product out of the code and into a JSON file
 *   nobody reviews.
 *
 *   A missing translation renders English rather than `alerts.sos.hint`. That
 *   matters here more than in most apps: the fallback is a working sentence a
 *   Kolkata reader can very likely act on, and a key name is not.
 *
 *   Nothing can be half-wired. A string either has a translation or it does not,
 *   and scripts/check-domain.js can prove the dictionaries hold no keys that no
 *   longer exist in the source.
 *
 * The cost is that editing an English sentence orphans its translation silently.
 * That is what the orphan assertion in the check script is for; it fails the build
 * rather than shipping a screen that reverts to English when someone fixes a typo.
 *
 * ------------------------------------------------------------------
 * Numbers stay in Latin digits
 * ------------------------------------------------------------------
 * ৪০০ and 400 are both read in West Bengal, and Bengali numerals would be the
 * more careful choice in a magazine. Not here: 112, a sensor percentage and a
 * distance in metres are read in Latin digits on every road sign, ambulance and
 * ration card in India, and the monospace face this app sets data in has no
 * tabular Bengali figures, so a live value would jitter as it ticked. One script
 * for words, one for numbers.
 */

/** Set once a native speaker has read these. Drives the notice in Settings. */
export const TRANSLATIONS_REVIEWED = false;

export const LANGUAGE_LABEL: Record<Language, string> = {
  en: 'English',
  bn: 'বাংলা',
  hi: 'हिन्दी',
};

/**
 * Substitute `{name}` placeholders.
 *
 * Placeholders rather than concatenation, because word order is the whole reason
 * this file exists: "Water rising fast in Jadavpur" puts the place last and
 * "যাদবপুরে দ্রুত জল বাড়ছে" puts it first. A `+` between two halves of an English
 * sentence cannot be translated at all.
 *
 * An unknown placeholder is left standing rather than blanked. A visible `{place}`
 * is a bug report; a sentence with a hole in it is a sentence somebody acts on.
 */
export function fill(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * True when a string carries Bengali or Devanagari letters.
 *
 * Asked of the text rather than of the household profile, because the text is the
 * ground truth and the profile is not. A Bengali reader still sees "Rabindra
 * Sarobar" in Latin when a landmark has no dictionary entry, and that string wants
 * the condensed face; the headline above it does not. Only the glyphs on the line
 * can decide which.
 *
 * See theme/type.ts for what the answer changes.
 */
export function hasIndicScript(s: string): boolean {
  // Devanagari and Bengali are adjacent blocks, so this is one range: 0900–09FF.
  return /[ऀ-৿]/.test(s);
}

/**
 * One string, in the language the household reads.
 *
 * `en` is both the key and the answer for English, so the English path does no
 * lookup and cannot be broken by a dictionary edit.
 */
export function t(
  lang: Language,
  en: string,
  vars?: Record<string, string | number>,
): string {
  const template = lang === 'en' ? en : (DICTIONARY[lang][en] ?? en);
  return vars ? fill(template, vars) : template;
}

/**
 * Bengali, as read in Kolkata.
 *
 * Written to be said out loud in a hurry, which is not the same as written
 * correctly. Three choices worth naming:
 *
 *   জল, not পানি. Both are water; the first is what West Bengal says and the second
 *   marks the sentence as from somewhere else, which is the last thing a warning
 *   about your own street should do.
 *
 *   The imperative is the আপনি form throughout — বেরিয়ে যান, not বেরিয়ে যাও.
 *   A government warning that addresses a stranger familiarly reads as a joke.
 *
 *   Sentences are short and verb-final where Bengali wants them to be, rather than
 *   tracking the English clause order. A translation that preserves English syntax
 *   is slower to read, and this is copy read once, standing up, in the rain.
 *
 * NOT REVIEWED BY A NATIVE SPEAKER. See TRANSLATIONS_REVIEWED.
 */
const BENGALI: Record<string, string> = {
  // Severity: the four stances, and what to do about each.
  // ---------------------------------------------------------------------------
  'Move to higher ground now. Do not try to drive through standing water.':
    'এখনই উঁচু জায়গায় চলে যান। জমা জলের মধ্যে দিয়ে গাড়ি চালানোর চেষ্টা করবেন না।',
  'Walk to the nearest shelter now. Take your phone, medicines and ID.':
    'এখনই সবচেয়ে কাছের আশ্রয়কেন্দ্রে হেঁটে যান। ফোন, ওষুধ আর পরিচয়পত্র সঙ্গে নিন।',
  'Pack a bag you can carry and stay off low-lying roads.':
    'নিজে বইতে পারবেন এমন একটা ব্যাগ গুছিয়ে রাখুন, আর নিচু রাস্তা এড়িয়ে চলুন।',
  'No action needed yet. Check back if the rain gets heavier.':
    'এখনই কিছু করার দরকার নেই। বৃষ্টি বাড়লে আবার দেখে নিন।',
  'Leave now and move upwind, away from the smoke. Close doors behind you.':
    'এখনই বেরিয়ে পড়ুন, ধোঁয়ার উল্টো দিকে, বাতাস যেদিক থেকে আসছে সেদিকে যান। পিছনে দরজা বন্ধ করে যান।',
  'Leave if you can smell smoke. Do not wait to see flames.':
    'ধোঁয়ার গন্ধ পেলেই বেরিয়ে যান। আগুন চোখে দেখার জন্য অপেক্ষা করবেন না।',
  'Clear dry leaves and fuel from around your home. Keep your phone charged.':
    'বাড়ির চারপাশ থেকে শুকনো পাতা আর জ্বালানি সরিয়ে ফেলুন। ফোন চার্জ দিয়ে রাখুন।',
  'No action needed yet. Avoid open fires and cooking outdoors.':
    'এখনই কিছু করার দরকার নেই। খোলা আগুন আর বাইরে রান্না এড়িয়ে চলুন।',

  Monitor: 'নজরে রাখুন',
  Prepare: 'তৈরি হন',
  'Act now': 'এখনই ব্যবস্থা নিন',
  'Leave now': 'এখনই বেরোন',

  Evacuate: 'সরে যান',
  'Move to shelter': 'আশ্রয়কেন্দ্রে যান',
  'Get ready': 'তৈরি হন',
  'Stay aware': 'সতর্ক থাকুন',

  Flooding: 'বন্যা',
  Fire: 'আগুন',
  Flood: 'বন্যা',
  // Headlines. The place comes first in Bengali, which is why these are
  // templates and not two halves joined with a plus.
  // ---------------------------------------------------------------------------
  'Water rising fast in {place}': '{place}-এ দ্রুত জল বাড়ছে',
  'Flooding likely in {place}': '{place}-এ বন্যার আশঙ্কা',
  'Water levels climbing in {place}': '{place}-এ জলস্তর বাড়ছে',
  'Heavy rain in {place}': '{place}-এ ভারী বৃষ্টি',
  'Fire spreading near {place}': '{place}-এর কাছে আগুন ছড়াচ্ছে',
  'Fire detected near {place}': '{place}-এর কাছে আগুন লেগেছে',
  'Fire risk high near {place}': '{place}-এর কাছে আগুনের ঝুঁকি বেশি',
  'Dry conditions near {place}': '{place}-এর কাছে শুকনো আবহাওয়া',

  // Place names. Transliterated rather than translated: these are the names on
  // the road signs, and a reader has to be able to match one to the other.
  'the Sundarbans edge': 'সুন্দরবনের প্রান্ত',
  'Rabindra Sarobar': 'রবীন্দ্র সরোবর',
  'Howrah Bridge': 'হাওড়া ব্রিজ',
  'Salt Lake': 'সল্ট লেক',
  'New Town': 'নিউ টাউন',
  Jadavpur: 'যাদবপুর',

  '{distance} away, in your area': '{distance} দূরে, আপনার এলাকাতেই',
  '{distance} away': '{distance} দূরে',
  '{distance} away, not in your area': '{distance} দূরে, আপনার এলাকায় নয়',

  // Severity as a spoken sentence, for the takeover and for screen readers.
  '{hazard} warning, critical. Leave now.':
    '{hazard} সতর্কতা, সঙ্কটজনক। এখনই বেরোন।',
  '{hazard} warning, high. Move to a shelter.':
    '{hazard} সতর্কতা, গুরুতর। আশ্রয়কেন্দ্রে চলে যান।',
  '{hazard} watch, medium. Get ready.': '{hazard} নজরদারি, মাঝারি। তৈরি হন।',
  '{hazard} notice, low. Stay aware.': '{hazard} বিজ্ঞপ্তি, কম। সতর্ক থাকুন।',
  // Shelters: whether to go, and whether everybody fits.
  // ---------------------------------------------------------------------------
  'At capacity. Do not go here.': 'জায়গা নেই। এখানে যাবেন না।',
  'Closed. Do not go here.': 'বন্ধ। এখানে যাবেন না।',
  'Only {free} place free — not enough for all {people} of you.':
    'মাত্র {free}টি জায়গা খালি — আপনাদের {people} জনের জন্য যথেষ্ট নয়।',
  'Only {free} places free — not enough for all {people} of you.':
    'মাত্র {free}টি জায়গা খালি — আপনাদের {people} জনের জন্য যথেষ্ট নয়।',
  'On higher ground, {metres} m above the local datum.':
    'উঁচু জায়গায়, স্থানীয় মাপের চেয়ে {metres} মিটার উপরে।',
  'The closest shelter still taking people.':
    'সবচেয়ে কাছের আশ্রয়কেন্দ্র যেখানে এখনও লোক নেওয়া হচ্ছে।',
  'Room for all {people} of you, {free} places free.':
    'আপনাদের {people} জনেরই জায়গা হবে, {free}টি জায়গা খালি।',
  '{free} places free.': '{free}টি জায়গা খালি।',
  'Full, {capacity} people inside': 'ভর্তি, ভিতরে {capacity} জন',
  'Nearly full, {free} places left': 'প্রায় ভর্তি, {free}টি জায়গা বাকি',
  '{free} of {capacity} places free': '{capacity}টির মধ্যে {free}টি জায়গা খালি',

  'No open shelter has room for all {people} of you. This is the best of them, with {free} place free — go together and ask at the desk.':
    'খোলা কোনও আশ্রয়কেন্দ্রেই আপনাদের {people} জনের জায়গা নেই। এটাই সবচেয়ে ভালো, {free}টি জায়গা খালি — সবাই একসঙ্গে যান আর ডেস্কে গিয়ে বলুন।',
  'No open shelter has room for all {people} of you. This is the best of them, with {free} places free — go together and ask at the desk.':
    'খোলা কোনও আশ্রয়কেন্দ্রেই আপনাদের {people} জনের জায়গা নেই। এটাই সবচেয়ে ভালো, {free}টি জায়গা খালি — সবাই একসঙ্গে যান আর ডেস্কে গিয়ে বলুন।',
  'This is the nearest shelter with room for {people}, but it is a long walk. Ask for a lift or a boat if you can.':
    '{people} জনের জায়গা আছে এমন সবচেয়ে কাছের আশ্রয়কেন্দ্র এটাই, কিন্তু হাঁটাপথ অনেক দূর। পারলে গাড়ি বা নৌকার ব্যবস্থা করে নিন।',
  'No medical desk here. Bring any medicines you or the people with you take daily.':
    'এখানে চিকিৎসার ব্যবস্থা নেই। আপনার বা সঙ্গের লোকেদের রোজকার ওষুধ সঙ্গে নিয়ে যান।',
  'Somebody in your house cannot swim. Do not wade, however short the stretch looks — half a metre of moving water takes an adult off their feet.':
    'আপনার বাড়ির কেউ সাঁতার জানেন না। জল যত কমই মনে হোক, হেঁটে পার হবেন না — আধ মিটার বইতে থাকা জলই একজন বড় মানুষকে ভাসিয়ে নিয়ে যায়।',

  // Who wrote the directions.
  'Surveyed on foot by the ward office.':
    'ওয়ার্ড অফিস নিজে হেঁটে দেখে নিয়েছে।',
  'Worked out from a street map, routed around the marked zones. Nobody has walked it, so trust your eyes at every turn.':
    'রাস্তার ম্যাপ থেকে বের করা, চিহ্নিত এলাকাগুলো এড়িয়ে। কেউ নিজে হেঁটে দেখেনি, তাই প্রতিটা মোড়ে নিজের চোখকে বিশ্বাস করুন।',
  // Units, distances and elapsed time. The number stays Latin; only the unit and
  // the word around it change.
  // ---------------------------------------------------------------------------
  '{n} m': '{n} মি',
  '{n} km': '{n} কিমি',
  'just now': 'এই মুহূর্তে',
  '{n} min ago': '{n} মিনিট আগে',
  '{n} hour ago': '{n} ঘণ্টা আগে',
  '{n} hours ago': '{n} ঘণ্টা আগে',
  '{n} day ago': '{n} দিন আগে',
  '{n} days ago': '{n} দিন আগে',
  '{n} minutes': '{n} মিনিট',
  '{n} hour': '{n} ঘণ্টা',
  '{n} hours': '{n} ঘণ্টা',
  // A span rather than a point in the past. `duration` in domain/geo.ts, for
  // "no signal for 40 min" — the same words as the '... ago' keys above with
  // the 'আগে' taken off, which is why they cannot be one key.
  '{n} min': '{n} মিনিট',
  '{n} day': '{n} দিন',
  '{n} days': '{n} দিন',

  north: 'উত্তর',
  'north-east': 'উত্তর-পূর্ব',
  east: 'পূর্ব',
  'south-east': 'দক্ষিণ-পূর্ব',
  south: 'দক্ষিণ',
  'south-west': 'দক্ষিণ-পশ্চিম',
  west: 'পশ্চিম',
  'north-west': 'উত্তর-পশ্চিম',

  // The takeover. Every word on the one screen nobody asked for.
  // ---------------------------------------------------------------------------
  'Issued {when}': '{when} জারি হয়েছে',
  'Walk to {shelter}': '{shelter}-এ হেঁটে যান',
  '{distance}, about {minutes} min on foot':
    '{distance}, হেঁটে প্রায় {minutes} মিনিট',
  'I have seen this': 'আমি দেখেছি',
  'Stops the alarm. The warning stays active.':
    'সাইরেন বন্ধ হবে। সতর্কতা কিন্তু চালু থাকবে।',
  // The feed: how it is grouped, and what an empty one says.
  // ---------------------------------------------------------------------------
  'Opens what to do about this alert':
    'এই সতর্কতার ব্যাপারে কী করতে হবে তা দেখায়',
  '{stance}. Tap for directions and what to take.':
    '{stance}। রাস্তা আর কী কী নিতে হবে জানতে ট্যাপ করুন।',
  'Also near you': 'আপনার কাছাকাছি আরও',
  'Within {km} km': '{km} কিমির মধ্যে',
  'Elsewhere in the district': 'জেলার অন্য জায়গায়',
  'Not in your area': 'আপনার এলাকায় নয়',
  'Checked at {time}. Pull down to check again.':
    '{time}-এ দেখা হয়েছে। আবার দেখতে নিচের দিকে টানুন।',
  'No active alerts near you': 'আপনার কাছে এখন কোনও সতর্কতা নেই',
  'Nothing is affecting {locality} right now. Sensors are still reporting, and this screen will change on its own if that stops being true.':
    '{locality}-এ এখন কোনও সমস্যা নেই। সেন্সরগুলো কিন্তু চালু আছে, আর অবস্থা বদলালে এই স্ক্রিন নিজেই বদলে যাবে।',
  'Last checked {time}': 'শেষ দেখা হয়েছে {time}',

  // The detail screen: its headings, its two buttons, and the bag to pack.
  // ---------------------------------------------------------------------------
  Alerts: 'সতর্কতা',
  'What to do': 'কী করবেন',
  'See the zone on the map': 'ম্যাপে এলাকাটা দেখুন',
  'Which way it is going': 'কোন দিকে যাচ্ছে',
  'Take with you': 'সঙ্গে যা নেবেন',
  'Why you are seeing this': 'কেন এটা দেখছেন',
  'Phone and charger, or a power bank':
    'ফোন আর চার্জার, বা একটা পাওয়ার ব্যাঙ্ক',
  'Any medicines you take daily': 'রোজ যে ওষুধ খান',
  'Aadhaar or another ID, and some cash':
    'আধার বা অন্য পরিচয়পত্র, আর কিছু নগদ টাকা',
  'Drinking water, and a torch if you have one':
    'খাওয়ার জল, আর টর্চ থাকলে সেটাও',
  'Leave everything else. Things can be replaced.':
    'বাকি সব ফেলে যান। জিনিস আবার হবে।',
  // Which way the sensor is going. Three whole sentences rather than a verb
  // dropped into one, because Bengali wants the verb where English wants a comma.
  // ---------------------------------------------------------------------------
  '{span} ago': '{span} আগে',
  now: 'এখন',
  water: 'জল',
  rainfall: 'বৃষ্টি',
  smoke: 'ধোঁয়া',
  'Holding steady. The {what} sensor has sat near {latest}% of its range for the last {span}.':
    'একই রকম আছে। গত {span} ধরে {what}-এর সেন্সর নিজের মাপের {latest}%-এর কাছাকাছিই রয়েছে।',
  'Still rising. The {what} sensor has gone from {from}% to {latest}% of its range in the last {span}.':
    'এখনও বাড়ছে। গত {span}-এ {what}-এর সেন্সর নিজের মাপের {from}% থেকে {latest}%-এ উঠেছে।',
  'Falling back. The {what} sensor has gone from {from}% to {latest}% of its range in the last {span}.':
    'কমতে শুরু করেছে। গত {span}-এ {what}-এর সেন্সর নিজের মাপের {from}% থেকে {latest}%-এ নেমেছে।',
  'At this rate that is {points} more points of range every hour.':
    'এই হারে চললে প্রতি ঘণ্টায় মাপের আরও {points} পয়েন্ট।',
  "Percentage of the sensor's full range, not a depth. Nobody has calibrated these nodes against a staff gauge, so this app will not put a number in centimetres on it.":
    'এটা সেন্সরের পুরো মাপের শতকরা হিসাব, জলের গভীরতা নয়। এই নোডগুলো কোনও মাপকাঠির সঙ্গে মিলিয়ে দেখা হয়নি, তাই এই অ্যাপ সেন্টিমিটারে কোনও সংখ্যা বলবে না।',

  // The evidence, and the tiles above it. 4095 stays in Latin digits.
  // ---------------------------------------------------------------------------
  'Water sensor is at {pct}% of full scale ({raw} of 4095).':
    'জলের সেন্সর পুরো মাপের {pct}% দেখাচ্ছে (4095-এর মধ্যে {raw})।',
  'Rainfall sensor is at {pct}%.': 'বৃষ্টির সেন্সর {pct}% দেখাচ্ছে।',
  'Humidity is {pct}%.': 'বাতাসে আর্দ্রতা {pct}%।',
  'The flame sensor is triggered.': 'আগুনের সেন্সরে সাড়া মিলেছে।',
  'Temperature is {c}°C.': 'তাপমাত্রা {c}°সে।',
  'Smoke sensor is at {pct}% of full scale ({raw} of 4095).':
    'ধোঁয়ার সেন্সর পুরো মাপের {pct}% দেখাচ্ছে (4095-এর মধ্যে {raw})।',
  'This warning was issued by the district authority rather than by a sensor reading.':
    'এই সতর্কতা কোনও সেন্সরের মাপ থেকে নয়, জেলা প্রশাসন থেকে দেওয়া হয়েছে।',

  'Water level': 'জলস্তর',
  Rainfall: 'বৃষ্টি',
  Humidity: 'আর্দ্রতা',
  'Flame sensor': 'আগুনের সেন্সর',
  Smoke: 'ধোঁয়া',
  Temperature: 'তাপমাত্রা',
  Triggered: 'সাড়া মিলেছে',
  Clear: 'কিছু নেই',

  'Reported by {node}': 'জানিয়েছে {node}',
  '{hazard} sensor, {kind} node, {status}':
    '{hazard} সেন্সর, {kind} নোড, {status}',
  'Recorded at {time}': 'রেকর্ড হয়েছে {time}-এ',
  // Severity as a bare adjective, for the row that says which zone you are in.
  // Lowercase keys on purpose: these sit inside a sentence, and the capitalised
  // 'Flood' / 'Fire' above are a different job.
  low: 'কম',
  medium: 'মাঝারি',
  high: 'গুরুতর',
  critical: 'সঙ্কটজনক',

  // SOS. The word SOS itself is never in here — see the note in Sos.tsx.
  // ---------------------------------------------------------------------------
  'Emergency SOS': 'আপৎকালীন SOS',
  'Sends your location to the district control room and to your emergency contacts. Use it when you need someone to come to you.':
    'আপনি কোথায় আছেন তা জেলা কন্ট্রোল রুমে আর আপনার বিপদের সময়ের নম্বরগুলোতে পাঠায়। কেউ আপনার কাছে আসা দরকার হলে এটা ব্যবহার করুন।',
  'Send emergency SOS': 'আপৎকালীন SOS পাঠান',
  'Hold for three seconds to send': 'পাঠাতে তিন সেকেন্ড চেপে ধরে রাখুন',
  Sending: 'পাঠানো হচ্ছে',
  'Reaching the control room': 'কন্ট্রোল রুমে পৌঁছোনো হচ্ছে',
  'Keep holding': 'চেপে ধরে রাখুন',
  'Hold for 3 seconds': '3 সেকেন্ড চেপে ধরুন',
  'Nothing was sent — you let go early. Hold until the count reaches zero.':
    'কিছু পাঠানো হয়নি — আগেই ছেড়ে দিয়েছেন। গোনা শূন্যে না পৌঁছোনো পর্যন্ত ধরে রাখুন।',
  'The hold is deliberately slow so this cannot happen in your pocket.':
    'ধরে রাখার সময়টা ইচ্ছে করেই বড় রাখা হয়েছে, যাতে পকেটের ভিতরে এটা হয়ে না যায়।',
  'No signal right now': 'এখন কোনও সিগন্যাল নেই',
  'Your SOS will be saved and sent the moment your phone finds a network. Nobody has it yet. A text message gets through on a tower that cannot carry anything else — send one below, and call 112 if you can.':
    'আপনার SOS জমা থাকবে, আর ফোনে নেটওয়ার্ক এলেই চলে যাবে। এখনও কেউ এটা পায়নি। যে টাওয়ার আর কিছুই বইতে পারে না, তাতেও একটা টেক্সট মেসেজ চলে যায় — নিচ থেকে একটা পাঠান, আর পারলে 112-এ ফোন করুন।',
  // What the SOS carries. Read by somebody deciding whether to hold the button,
  // so it is written as a list of facts and not as reassurance.
  'What gets sent': 'কী কী পাঠানো হবে',
  'Your location': 'আপনি কোথায় আছেন',
  Coordinates: 'অক্ষাংশ-দ্রাঘিমাংশ',
  '{lat}, {lng} within {accuracy} m': '{lat}, {lng} — {accuracy} মিটারের মধ্যে',
  'Hazard at your location': 'আপনার জায়গায় কী বিপদ',
  '{zone}, marked {severity}': '{zone}, {severity} হিসেবে চিহ্নিত',
  'No marked zone at your location': 'আপনার জায়গায় চিহ্নিত কোনও এলাকা নেই',
  'Who is in the house': 'বাড়িতে কে কে আছেন',
  'Not recorded — the questions in Settings add this':
    'লেখা নেই — সেটিংসে ওই প্রশ্নগুলোর উত্তর দিলে এটা যোগ হবে',
  'Your phone number': 'আপনার ফোন নম্বর',
  'From your SIM': 'আপনার সিম থেকে',

  // The household line under it. '{n} জন' for both one and many: Bengali does
  // not change the counter word for number, so the two English keys collapse to
  // one Bengali sentence and that is not a mistake.
  '{n} person': '{n} জন',
  '{n} people': '{n} জন',
  '{n} needing help to move': 'সরাতে সাহায্য লাগবে {n} জনের',
  '{n} who cannot swim': '{n} জন সাঁতার জানেন না',

  // The two other ways out: a voice call, and 140 bytes.
  'Call 112 instead': 'বরং 112-এ ফোন করুন',
  '112 reaches police, fire and ambulance. Call it if you are hurt or trapped — a voice call gets a person, not a queue.':
    '112-এ পুলিশ, দমকল আর অ্যাম্বুল্যান্স সবই পাওয়া যায়। আঘাত পেয়ে থাকলে বা আটকে গেলে ফোন করুন — ফোনে সরাসরি একজন মানুষ পাবেন, লাইনে দাঁড়াতে হবে না।',
  'Send it as a text message': 'টেক্সট মেসেজ হিসেবে পাঠান',
  'This phone has no messaging app to open. Nothing was sent.':
    'এই ফোনে খোলার মতো কোনও মেসেজ অ্যাপ নেই। কিছু পাঠানো হয়নি।',
  'Opens your messages with everything above already written. Choose who to send it to — a relative, a neighbour, your ward councillor.':
    'উপরের সব কথা লেখা অবস্থায় আপনার মেসেজ অ্যাপ খুলে যাবে। কাকে পাঠাবেন বেছে নিন — আত্মীয়, পাশের বাড়ির লোক, বা আপনার ওয়ার্ড কাউন্সিলর।',
  // The confirmation. 'জমা আছে' against 'হয়ে গেছে' is the whole distinction the
  // screen exists to make, and it must survive being read at a glance.
  'Saved, not sent yet': 'জমা আছে, এখনও পাঠানো হয়নি',
  'Help has been asked for': 'সাহায্য চাওয়া হয়ে গেছে',
  'Your phone has no signal. The SOS is stored and will go out by SMS as soon as a network appears. Nobody has been alerted yet.':
    'আপনার ফোনে সিগন্যাল নেই। SOS জমা রাখা হয়েছে, নেটওয়ার্ক এলেই SMS হয়ে চলে যাবে। এখনও কাউকে জানানো হয়নি।',
  'The district control room has your location in {locality} and your emergency contacts have been messaged.':
    'জেলা কন্ট্রোল রুম জানে আপনি {locality}-এ আছেন, আর আপনার বিপদের সময়ের নম্বরগুলোতেও খবর গেছে।',
  'Do not wait for this': 'এর ভরসায় বসে থাকবেন না',
  'If you are in danger now, move to higher ground or call 112 from a phone with signal.':
    'এখন যদি বিপদে থাকেন, উঁচু জায়গায় চলে যান, বা সিগন্যাল আছে এমন ফোন থেকে 112-এ ফোন করুন।',
  'Keep your phone with you. The control room may call this number.':
    'ফোন সঙ্গে রাখুন। কন্ট্রোল রুম এই নম্বরেই ফোন করতে পারে।',
  'Back to alerts': 'সতর্কতায় ফিরে যান',
  Done: 'হয়ে গেছে',
  // The roll-call. The inverse of the button above it, and the one place in this
  // app where the app has to say plainly that it is telling somebody NOT to come.
  // ---------------------------------------------------------------------------
  'Tell the district you are safe': 'জেলাকে জানান আপনারা নিরাপদে আছেন',
  'Answer the household questions first. A message with no address adds a name to a list of unknowns instead of taking one off the search list.':
    'আগে বাড়ির প্রশ্নগুলোর উত্তর দিন। ঠিকানা ছাড়া খবর পাঠালে খোঁজার তালিকা থেকে একটা নাম কাটা পড়ে না, বরং অজানা লোকের তালিকায় একটা নাম যোগ হয়।',
  'Answer the questions': 'প্রশ্নগুলোর উত্তর দিন',
  'The district has you marked safe': 'জেলার খাতায় আপনারা নিরাপদ',
  'Reported at {time}, {ago}. Your house is not on the rescue list.':
    '{time}-এ জানানো হয়েছে, {ago}। আপনার বাড়ি উদ্ধারের তালিকায় নেই।',
  'Water rises again. If anything changes, take this back — nobody will think less of you for it.':
    'জল আবার বাড়ে। কিছু বদলালে এটা তুলে নিন — তার জন্য কেউ আপনাকে ছোট করে দেখবে না।',
  'Telling them…': 'জানানো হচ্ছে…',
  'We need help after all': 'আমাদের সাহায্য দরকার',
  'If all {people} of you are somewhere safe and nobody needs help, this takes your house off the rescue list.':
    'আপনারা {people} জনই যদি নিরাপদ জায়গায় থাকেন আর কারও সাহায্য দরকার না হয়, তাহলে এতে আপনার বাড়ি উদ্ধারের তালিকা থেকে বাদ যাবে।',
  'If you are somewhere safe and do not need help, this takes your house off the rescue list.':
    'আপনি যদি নিরাপদ জায়গায় থাকেন আর সাহায্য দরকার না হয়, তাহলে এতে আপনার বাড়ি উদ্ধারের তালিকা থেকে বাদ যাবে।',
  'A search team will stop looking for this address. Only send this if everyone is accounted for.':
    'উদ্ধারকারী দল এই ঠিকানায় আর খুঁজবে না। সবার খোঁজ পাওয়া গেলেই তবে এটা পাঠান।',
  'Yes, take us off the list': 'হ্যাঁ, আমাদের তালিকা থেকে বাদ দিন',
  'Not yet': 'এখন নয়',
  'We are safe': 'আমরা নিরাপদে আছি',
  'No answer from the district. Nothing has been reported — try again when you have a signal.':
    'জেলা থেকে কোনও উত্তর আসেনি। কিছুই জানানো হয়নি — সিগন্যাল পেলে আবার চেষ্টা করুন।',
  'Your answers are still only on this phone, so there is no record to update. Nothing has been reported.':
    'আপনার উত্তরগুলো এখনও শুধু এই ফোনেই আছে, তাই বদলানোর মতো কোনও নথি নেই। কিছুই জানানো হয়নি।',
  'There are no household details to report. Nothing has been sent.':
    'জানানোর মতো বাড়ির কোনও তথ্য নেই। কিছুই পাঠানো হয়নি।',
  // The walk. Chrome only — the turns themselves arrive from the ward office or
  // from a router and stay in the language they were written in.
  // ---------------------------------------------------------------------------
  Alert: 'সতর্কতা',
  Open: 'খোলা',
  Full: 'ভর্তি',
  Closed: 'বন্ধ',
  '{distance} left, about {minutes} min on foot':
    'আরও {distance} বাকি, হেঁটে প্রায় {minutes} মিনিট',
  'This walk starts inside the flood zone':
    'এই হাঁটা শুরুই হচ্ছে বন্যার এলাকার ভিতর থেকে',
  'Go now rather than later, and turn back to higher ground if water reaches your knees.':
    'পরে নয়, এখনই বেরোন — আর জল হাঁটু পর্যন্ত উঠলে উঁচু জায়গায় ফিরে যান।',
  Then: 'তারপর',
  'Step {n} of {total}': '{total}টির মধ্যে {n} নম্বর ধাপ',
  'I have arrived': 'আমি পৌঁছে গেছি',
  'Done, next step': 'হয়েছে, পরের ধাপ',
  'Other shelters': 'অন্য আশ্রয়কেন্দ্র',
  'Pick a different one if this route looks wrong to you. You know your streets better than we do.':
    'এই রাস্তা আপনার ভুল মনে হলে অন্য একটা বেছে নিন। আপনার পাড়ার রাস্তা আপনি আমাদের চেয়ে ভালো চেনেন।',
  '{shelter}, {distance} away, {status}': '{shelter}, {distance} দূরে, {status}',
  '{distance}, {minutes} min walk': '{distance}, হাঁটাপথে {minutes} মিনিট',
  'You have reached {shelter}': 'আপনি {shelter}-এ পৌঁছে গেছেন',
  'Find a volunteer or an official at the entrance and give them your name so the district knows you are safe.':
    'গেটের কাছে কোনও স্বেচ্ছাসেবক বা সরকারি লোককে খুঁজে নিজের নাম বলে দিন, যাতে জেলা জানতে পারে আপনি নিরাপদে আছেন।',
  // The compass fallback, for when nobody has surveyed the walk and the router
  // could not be asked. A heading, said out loud as a heading.
  'Direction only': 'শুধু দিক',
  'Head {heading}': '{heading} দিকে চলুন',
  'That is the straight-line direction. Streets will not run that way, so keep to the main road that carries you {heading} and ask a police officer or a volunteer if you lose it.':
    'এটা সরলরেখার দিক। রাস্তা ঠিক ওই দিকে যাবে না, তাই যে বড় রাস্তা আপনাকে {heading} দিকে নিয়ে যাচ্ছে সেটাই ধরে রাখুন, আর পথ হারালে পুলিশ বা কোনও স্বেচ্ছাসেবককে জিজ্ঞেস করুন।',
  'No walking route avoids the water': 'জল এড়িয়ে হাঁটার কোনও রাস্তা নেই',
  'Every way out of here crosses a marked zone. Do not wade to follow the direction below. Call 112 and ask for a boat, and move to the highest floor you can reach while you wait.':
    'এখান থেকে বেরোনোর সব রাস্তাই কোনও চিহ্নিত এলাকার মধ্যে পড়ছে। নিচের দিক ধরে হেঁটে জল পার হওয়ার চেষ্টা করবেন না। 112-এ ফোন করে নৌকা চান, আর অপেক্ষা করার সময় যত উঁচু তলায় ওঠা যায় উঠে যান।',
  'Walk to this address': 'এই ঠিকানায় হেঁটে যান',
  'Nobody has surveyed the walk to this shelter. We are asking a street map for one now — the direction above holds either way.':
    'এই আশ্রয়কেন্দ্রের হাঁটাপথ কেউ নিজে হেঁটে দেখেনি। রাস্তার ম্যাপ থেকে একটা বের করার চেষ্টা চলছে — উপরের দিকটা তাতে বদলাবে না।',
  "We only have step-by-step directions for some shelters. Rather than show you another shelter's streets, we are giving you the direction and the address for this one.":
    'ধাপে ধাপে রাস্তা শুধু কয়েকটা আশ্রয়কেন্দ্রের জন্যই আছে। অন্য কেন্দ্রের রাস্তা দেখানোর চেয়ে এটার দিক আর ঠিকানাই দিচ্ছি।',
  // How much to trust the screen. The freshness bar is the first thing above the
  // feed and the last thing a reader should have to guess at, so all four states
  // are here — including 'Live', which is the quiet one.
  // ---------------------------------------------------------------------------
  'Live. Updated {time}.': 'সরাসরি। {time}-এ আপডেট হয়েছে।',
  'No signal. Showing what we saved at {time}.':
    'সিগন্যাল নেই। {time}-এ যা সেভ করা ছিল তাই দেখানো হচ্ছে।',
  'No signal for {span}. These numbers may be out of date.':
    '{span} ধরে সিগন্যাল নেই। এই সংখ্যাগুলো পুরনো হয়ে থাকতে পারে।',
  'No signal and nothing saved yet. Call 112 for emergencies.':
    'সিগন্যাল নেই, সেভ করাও কিছু নেই। বিপদে 112-এ ফোন করুন।',
  'Try to reconnect': 'আবার জোড়া লাগানোর চেষ্টা করুন',
  Trying: 'চেষ্টা চলছে',
  Retry: 'আবার',
  // The empty feed, which is the most dangerous card in the app. Every branch
  // repeats that this is not an all-clear, and the repetition is the point: an
  // English sentence saying so, shown to a Bengali reader looking at a blank
  // screen, is indistinguishable from a blank screen.
  // ---------------------------------------------------------------------------
  'Checking for alerts': 'সতর্কতা আছে কিনা দেখা হচ্ছে',
  'Reading the district sensor network for {locality}. This usually takes a moment on a normal connection and longer on a weak one.':
    '{locality}-এর জন্য জেলার সেন্সরগুলো পড়া হচ্ছে। নেট ঠিক থাকলে এক মুহূর্ত, দুর্বল থাকলে একটু বেশি সময় লাগে।',
  'If it does not load, this screen will say so plainly rather than keep spinning.':
    'যদি না আসে, এই স্ক্রিন ঘুরতেই থাকবে না — পরিষ্কার করে বলে দেবে।',
  'We could not check for alerts': 'সতর্কতা আছে কিনা দেখা গেল না',
  'There is no usable connection, so nothing on this screen is current. This is not an all-clear — a warning could be active for {locality} and this phone would not know.':
    'কাজ করার মতো নেট নেই, তাই এই স্ক্রিনের কিছুই এখনকার নয়। এর মানে বিপদ নেই তা নয় — {locality}-এর জন্য সতর্কতা চালু থাকতে পারে আর এই ফোন তা জানবে না।',
  'For anything happening right now, call 112. Move to higher ground and away from water without waiting for this app.':
    'এখন যা ঘটছে তার জন্য 112-এ ফোন করুন। এই অ্যাপের জন্য অপেক্ষা না করে উঁচু জায়গায়, জল থেকে দূরে সরে যান।',
  'This build has no data source': 'এই বিল্ডে কোনও ডেটার সংযোগ নেই',
  'The app was compiled without the district database address, so it cannot receive alerts at all. This is not an all-clear and it will not fix itself.':
    'জেলার ডেটাবেসের ঠিকানা ছাড়াই অ্যাপটা তৈরি হয়েছে, তাই এটা কোনও সতর্কতাই পাবে না। এর মানে বিপদ নেই তা নয়, আর নিজে থেকে ঠিকও হবে না।',
  'Whoever installed this build needs to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY and rebuild. Do not rely on this phone for warnings until then.':
    'যিনি এই বিল্ড ইনস্টল করেছেন তাঁকে EXPO_PUBLIC_SUPABASE_URL আর EXPO_PUBLIC_SUPABASE_ANON_KEY বসিয়ে আবার বিল্ড করতে হবে। তার আগে সতর্কতার জন্য এই ফোনের উপর ভরসা করবেন না।',
  'The alert service refused': 'সতর্কতার সার্ভার সাড়া দিল না',
  'We reached the district system and it would not answer. This is not an all-clear — assume nothing about conditions in {locality}.':
    'জেলার সিস্টেম পর্যন্ত পৌঁছনো গেছে, কিন্তু সে উত্তর দিচ্ছে না। এর মানে বিপদ নেই তা নয় — {locality}-এ কী অবস্থা, তা নিয়ে কিছুই ধরে নেবেন না।',
  'This is a fault at our end, not on your phone. Trying again may work, but call 112 for anything urgent rather than waiting.':
    'গোলমাল আমাদের দিকে, আপনার ফোনে নয়। আবার চেষ্টা করলে হতে পারে, তবে জরুরি কিছু হলে অপেক্ষা না করে 112-এ ফোন করুন।',
  'No alert data': 'সতর্কতার কোনও ডেটা নেই',
  'Nothing loaded, and we cannot tell you why. This is not an all-clear — assume nothing about conditions in {locality}.':
    'কিছুই আসেনি, আর কেন আসেনি তা আমরা বলতে পারছি না। এর মানে বিপদ নেই তা নয় — {locality}-এ কী অবস্থা, তা নিয়ে কিছুই ধরে নেবেন না।',
  'For anything happening right now, call 112.':
    'এখন যা ঘটছে তার জন্য 112-এ ফোন করুন।',
  'Checking…': 'দেখা হচ্ছে…',
  'Try again': 'আবার চেষ্টা করুন',
  // Am I in a marked zone right now. The zone's own name is never translated —
  // it is what the radio and the notice board are calling it.
  // ---------------------------------------------------------------------------
  'You are inside a {hazard} zone': 'আপনি {hazard}-চিহ্নিত এলাকার ভিতরে আছেন',
  'You are outside all risk zones': 'আপনি কোনও বিপদ-চিহ্নিত এলাকায় নেই',
  'No zones mapped here': 'এখানে কোনও এলাকা চিহ্নিত করা হয়নি',
  'Marked {severity} by the district authority.':
    'জেলা প্রশাসন এটাকে {severity} বলে চিহ্নিত করেছে।',
  'Nearest marked zone is {distance} away.':
    'সবচেয়ে কাছের চিহ্নিত এলাকা {distance} দূরে।',
  'No hazard zones have been mapped for this district yet, so there is nothing here to be outside of.':
    'এই জেলার জন্য এখনও কোনও বিপদের এলাকা চিহ্নিত হয়নি, তাই বাইরে থাকার মতো কিছুই এখানে নেই।',
  'Location accurate to {n} m': 'আপনার জায়গা {n} মিটার পর্যন্ত ঠিক',
  'Assumed location. This phone has not reported a fix.':
    'ধরে নেওয়া জায়গা। এই ফোন এখনও নিজের অবস্থান জানায়নি।',
  // Spoken by a screen reader, so they are whole sentences rather than the
  // fragments above.
  'You are inside {zone}, a {severity} {hazard} zone':
    'আপনি {zone}-এর ভিতরে আছেন, এটি একটি {severity} {hazard}-এর এলাকা',
  'You are outside all risk zones. Nearest is {distance} away':
    'আপনি কোনও বিপদ-চিহ্নিত এলাকায় নেই। সবচেয়ে কাছেরটি {distance} দূরে',
  'No hazard zones have been mapped for this district yet':
    'এই জেলার জন্য এখনও কোনও বিপদের এলাকা চিহ্নিত হয়নি',
  'Opens the zone map': 'এলাকার ম্যাপ খোলে',

  // The tab bar. SOS is not here on purpose.
  Map: 'ম্যাপ',
  Settings: 'সেটিংস',
  'Back to {destination}': '{destination}-এ ফিরে যান',
  // The map. Zone and shelter names are never translated — the legend words are
  // what a reader needs in order to read the marks, and the marks are named by the
  // district.
  // ---------------------------------------------------------------------------
  'Zone map': 'এলাকার ম্যাপ',
  'You are inside {zone}': 'আপনি {zone}-এর ভিতরে আছেন',
  '{locality}, outside all marked zones':
    '{locality}, কোনও চিহ্নিত এলাকার বাইরে',
  '{distance} away, {minutes} min on foot':
    '{distance} দূরে, হেঁটে {minutes} মিনিট',
  'Walk here': 'এখানে হেঁটে যান',
  'This shelter is not taking people. Tap another marker to pick a different one.':
    'এই আশ্রয়কেন্দ্র এখন লোক নিচ্ছে না। অন্য একটা চিহ্নে চাপ দিয়ে আলাদা কেন্দ্র বেছে নিন।',
  'Flood zone': 'বন্যার এলাকা',
  'Fire zone': 'আগুনের এলাকা',
  'Shelter open': 'আশ্রয়কেন্দ্র খোলা',
  'Full or closed': 'ভর্তি বা বন্ধ',
  You: 'আপনি',
  'Zoom in': 'বড় করুন',
  'Zoom out': 'ছোট করুন',
  'Centre the map on my location': 'আমি যেখানে আছি সেখানে ম্যাপ আনুন',
  'Show every zone and shelter in the district':
    'জেলার সব এলাকা আর আশ্রয়কেন্দ্র দেখান',
  'No street map in this build. Hazard geometry only.':
    'এই বিল্ডে রাস্তার ম্যাপ নেই। কেবল বিপদের এলাকাগুলো।',
  'Street map unreachable. Hazard geometry only.':
    'রাস্তার ম্যাপ পাওয়া যাচ্ছে না। কেবল বিপদের এলাকাগুলো।',
  'Streets: {attribution}': 'রাস্তা: {attribution}',
  'Loading the district map': 'জেলার ম্যাপ আসছে',
  'No map data': 'ম্যাপের কোনও ডেটা নেই',
  'Fetching hazard zones and shelters.':
    'বিপদের এলাকা আর আশ্রয়কেন্দ্রগুলো আনা হচ্ছে।',
  'This build has no data source, so it has no zones or shelters to show. That is a fault in the build, not a sign the district is clear.':
    'এই বিল্ডে ডেটার কোনও সংযোগ নেই, তাই দেখানোর মতো এলাকা বা আশ্রয়কেন্দ্র নেই। এটা বিল্ডের গোলমাল, জেলায় বিপদ নেই তার লক্ষণ নয়।',
  'We could not load hazard zones or shelters. A blank map here does not mean the ground around you is safe — it means we do not know.':
    'বিপদের এলাকা বা আশ্রয়কেন্দ্র আনা গেল না। এখানে ফাঁকা ম্যাপের মানে আপনার চারপাশ নিরাপদ নয় — মানে আমরা জানি না।',
  // The settings screen. It used to stay in English on the argument that a
  // mistranslated label is cheap; but the sentences here are the ones that say
  // whether push works and how long the district keeps a family's details, and a
  // reader who cannot follow those is left believing something untrue about their
  // own data.
  // ---------------------------------------------------------------------------
  'BHOOMI-NETRA citizen alerts': 'BHOOMI-NETRA নাগরিক সতর্কতা',
  'Push notifications': 'পুশ নোটিফিকেশন',
  'On. Critical alerts for your ward will reach you with the screen off.':
    'চালু। আপনার ওয়ার্ডের চরম সতর্কতা স্ক্রিন বন্ধ থাকলেও আপনার কাছে পৌঁছাবে।',
  'Not available in this build. You will only be alerted while the app is open.':
    'এই বিল্ডে নেই। অ্যাপ খোলা থাকলেই কেবল আপনি সতর্কতা পাবেন।',
  On: 'চালু',
  Unavailable: 'নেই',
  'Vibration for critical alerts': 'চরম সতর্কতায় কম্পন',
  'On, and not switchable. A critical alert for the zone you are standing in is the one thing this app will not let you silence.':
    'চালু, আর বন্ধ করা যায় না। আপনি যে এলাকায় দাঁড়িয়ে আছেন সেখানকার চরম সতর্কতা — এই একটা জিনিস এই অ্যাপ আপনাকে চুপ করাতে দেবে না।',
  'Test a critical alert': 'একটা চরম সতর্কতা পরখ করুন',
  'Plays the real vibration pattern and opens the takeover screen, so you know what it looks like before it matters.':
    'আসল কম্পনটাই বাজায় আর পুরো স্ক্রিন জোড়া সতর্কতা দেখায়, যাতে দরকারের আগেই আপনি জানেন সেটা কেমন দেখতে।',
  // The connection row, and the four words the freshness state resolves to. They
  // are single words because they are dropped into a sentence, and they match the
  // wording of the bar at the top of the feed on purpose.
  Connection: 'সংযোগ',
  'Simulate no signal': 'সিগন্যাল নেই — এমন করে দেখুন',
  'Review affordance, not a real setting. Turn it on to see how the app behaves offline. Data is currently {freshness}, last fetched {time}.':
    'এটা আসল সেটিং নয়, দেখে নেওয়ার ব্যবস্থা। চালু করলে বুঝবেন সিগন্যাল ছাড়া অ্যাপটা কীরকম চলে। এখনকার তথ্য {freshness}, শেষ আনা হয়েছে {time}-এ।',
  live: 'সরাসরি',
  cached: 'সেভ করা',
  stale: 'পুরনো',
  offline: 'সিগন্যাল ছাড়া',

  About: 'অ্যাপ সম্পর্কে',
  'BHOOMI-NETRA watches river levels, rainfall, temperature, smoke and flame from sensor nodes across the district and warns the people nearest to a hazard first.':
    'BHOOMI-NETRA জেলার সেন্সর নোড থেকে নদীর জলের উচ্চতা, বৃষ্টি, তাপমাত্রা, ধোঁয়া আর আগুনের উপর নজর রাখে, আর বিপদের সবচেয়ে কাছের মানুষদের আগে সতর্ক করে।',
  'It is not a substitute for emergency services. For anything happening right now, call 112.':
    'এটা জরুরি পরিষেবার বদলি নয়। এই মুহূর্তে কিছু ঘটে থাকলে 112-এ ফোন করুন।',
  'Sensor data from the district node network. Zone boundaries and shelter status are set by the district authority.':
    'সেন্সরের তথ্য জেলার নোড নেটওয়ার্ক থেকে। এলাকার সীমানা আর আশ্রয়কেন্দ্রের অবস্থা জেলা প্রশাসন ঠিক করে।',
  // The location row. The coordinate pair itself stays in Latin digits — see
  // coordinateLabel in domain/geo.ts.
  Location: 'অবস্থান',
  '{coords}, accurate to {n} m. Fix taken {time}.':
    '{coords}, {n} মিটার পর্যন্ত ঠিক। {time}-এ নেওয়া।',
  'This app cannot see your location, so it is working from a stated position near {place}. Zone and shelter answers may be about somewhere you are not.':
    'এই অ্যাপ আপনার অবস্থান দেখতে পাচ্ছে না, তাই {place}-এর কাছে একটা ধরে নেওয়া জায়গা থেকে কাজ করছে। এলাকা আর আশ্রয়কেন্দ্র নিয়ে উত্তরগুলো এমন জায়গার হতে পারে যেখানে আপনি নেই।',
  'Waiting for the first fix from this phone. Until it arrives the app is working from a stated position near {place}, so zone and shelter answers may be about somewhere you are not.':
    'এই ফোন থেকে প্রথম অবস্থানের অপেক্ষা চলছে। সেটা আসা পর্যন্ত অ্যাপ {place}-এর কাছে একটা ধরে নেওয়া জায়গা থেকে কাজ করছে, তাই এলাকা আর আশ্রয়কেন্দ্র নিয়ে উত্তরগুলো এমন জায়গার হতে পারে যেখানে আপনি নেই।',
  'From this phone': 'এই ফোন থেকে',
  Assumed: 'ধরে নেওয়া',
  'Open location permissions': 'অবস্থানের অনুমতি খুলুন',
  'Allow location while using the app. Nothing is sent anywhere until you press SOS, and the app never tracks you with the screen off.':
    'অ্যাপ ব্যবহারের সময় অবস্থান জানার অনুমতি দিন। SOS না চাপা পর্যন্ত কোথাও কিছু যায় না, আর স্ক্রিন বন্ধ থাকলে অ্যাপ কখনও আপনার পিছু নেয় না।',
  // The language group. The unreviewed notice is the one string in this file whose
  // whole job is to admit that the rest of the file has not been checked.
  Language: 'ভাষা',
  'The whole app can be read in Bengali or Hindi: the alerts, the SOS screen, the walking directions, the household questions and this screen.':
    'পুরো অ্যাপটাই বাংলা বা হিন্দিতে পড়া যায়: সতর্কতা, SOS-এর স্ক্রিন, হাঁটার পথনির্দেশ, বাড়ির লোকজন নিয়ে প্রশ্নগুলো আর এই স্ক্রিনও।',
  'The whole app is in this language: the alerts, the SOS screen, the walking directions, the household questions and this screen.':
    'পুরো অ্যাপটাই এই ভাষায়: সতর্কতা, SOS-এর স্ক্রিন, হাঁটার পথনির্দেশ, বাড়ির লোকজন নিয়ে প্রশ্নগুলো আর এই স্ক্রিনও।',
  'Not yet checked by a Bengali or Hindi speaker':
    'বাংলা বা হিন্দি জানেন এমন কেউ এখনও দেখে দেননি',
  'Every line of this app was translated for this build and nobody has read it back against the English. If a warning reads oddly, trust the action and not the wording — switch to English to compare, and call 112 if you are unsure.':
    'এই অ্যাপের প্রতিটি লাইন এই বিল্ডের জন্য অনুবাদ করা হয়েছে, ইংরেজির সঙ্গে মিলিয়ে কেউ পড়ে দেখেননি। কোনও সতর্কতা অদ্ভুত লাগলে কথার বাঁধুনি নয়, কী করতে বলা হচ্ছে সেটাই মানুন — মিলিয়ে দেখতে ইংরেজিতে বদলে নিন, আর সন্দেহ হলে 112-এ ফোন করুন।',
  'Change the language': 'ভাষা বদলান',
  'It is the first of the household questions, so it is kept with the rest of your details — the district writes and calls in the same language.':
    'বাড়ির লোকজন নিয়ে প্রশ্নগুলোর মধ্যে এটাই প্রথম, তাই এটা আপনার বাকি তথ্যের সঙ্গেই থাকে — জেলা প্রশাসন এই একই ভাষায় চিঠি লেখে আর ফোন করে।',
  // The household group. 'On record' against 'This phone only' is the load-bearing
  // pair: one of them means a control room can see this family and the other means
  // it cannot.
  'Your household': 'আপনার বাড়ির লোকজন',
  'Not answered': 'উত্তর দেওয়া হয়নি',
  'Nothing here tells the app who lives with you, so it assumes one person, no ward and nobody who needs help getting out. Five short steps changes that, and every line in them is optional.':
    'আপনার সঙ্গে কে কে থাকেন তা এখানে কিছুই বলা নেই, তাই অ্যাপ ধরে নেয় একজন মানুষ, কোনও ওয়ার্ড নেই, আর বেরোতে কারও সাহায্য দরকার নেই। পাঁচটা ছোট ধাপে সেটা বদলে যায়, আর তার প্রতিটি লাইনই ইচ্ছেমতো ছেড়ে দেওয়া যায়।',
  'Answer the household questions': 'বাড়ির লোকজন নিয়ে প্রশ্নগুলোর উত্তর দিন',
  'ward {n}': 'ওয়ার্ড {n}',
  '{who}. On the district\'s records, last confirmed {when}.':
    '{who}। জেলা প্রশাসনের খাতায় আছে, শেষ নিশ্চিত করা হয়েছে {when}।',
  '{who}. Saved on this phone {when} and not sent to the district yet.':
    '{who}। {when} এই ফোনে সেভ করা হয়েছে, জেলা প্রশাসনের কাছে এখনও পাঠানো হয়নি।',
  Saved: 'সেভ করা আছে',
  'On record': 'খাতায় আছে',
  'This phone only': 'কেবল এই ফোনে',
  'Send it to the district now': 'এখনই জেলা প্রশাসনের কাছে পাঠান',
  'Still no answer from the district\'s server. Your details are safe on this phone, and the app tries again every time it opens.':
    'জেলা প্রশাসনের সার্ভার এখনও সাড়া দিচ্ছে না। আপনার তথ্য এই ফোনে সুরক্ষিত আছে, আর অ্যাপ খোলার প্রতিবার আবার চেষ্টা করে।',
  'Review or change these details': 'এই তথ্যগুলো দেখুন বা বদলান',
  'Saving them again resets the two-year clock, so a look once a year is enough to stay on the list.':
    'আবার সেভ করলে দুই বছরের হিসেব নতুন করে শুরু হয়, তাই তালিকায় থাকতে বছরে একবার দেখে নেওয়াই যথেষ্ট।',
  'Delete from this phone': 'এই ফোন থেকে মুছুন',
  'Tap again to delete from this phone': 'মুছতে আরেকবার চাপ দিন',
  'Clears the answers from this phone only. The district keeps its copy until it is two years old, and reinstalling will offer it back.':
    'কেবল এই ফোন থেকে উত্তরগুলো মুছে যায়। জেলা প্রশাসনের কাছে থাকা কপি দুই বছর বয়স হওয়া পর্যন্ত থাকে, আর অ্যাপ আবার বসালে সেটা ফিরিয়ে নেওয়ার প্রস্তাব আসবে।',
  // The vulnerability counts, as a sentence. The conjunction is its own key because
  // the word joining the last two items in a list is a fact about the language.
  '{n} aged 60 or over': '{n} জনের বয়স 60 বা তার বেশি',
  '{n} under two': '{n} জনের বয়স দুই বছরের কম',
  '{n} pregnant': '{n} জন গর্ভবতী',
  '{n} who cannot leave unaided': '{n} জন সাহায্য ছাড়া বেরোতে পারেন না',
  '{list} and {last}': '{list} আর {last}',
  'On record: {list}.': 'খাতায় আছে: {list}।',
  // The household questions. This screen answers to the draft rather than the saved
  // profile, so these strings are also the only preview of the translation anybody
  // sees before choosing it for the alerts.
  // ---------------------------------------------------------------------------
  Back: 'পিছনে',
  Cancel: 'বাতিল',
  'Not now': 'এখন নয়',
  Continue: 'পরের ধাপ',
  'Save these details': 'এই তথ্যগুলো সেভ করুন',
  'Save what I have': 'যতটা দিয়েছি সেটাই সেভ করুন',
  'Who is in your house?': 'আপনার বাড়িতে কে কে আছেন?',
  'Check your details': 'আপনার তথ্য দেখে নিন',
  'When water rises, a rescue team works from a list. If your house is on it they know how many people to plan for and who cannot walk out unaided. If it is not, they knock and hope.':
    'জল বাড়লে উদ্ধারকারী দল একটা তালিকা ধরে কাজ করে। আপনার বাড়ি সেই তালিকায় থাকলে তারা জানে কত জনের জন্য ব্যবস্থা করতে হবে আর কে সাহায্য ছাড়া হেঁটে বেরোতে পারবেন না। না থাকলে তারা দরজায় টোকা দেয় আর আশা করে।',
  'Five short steps, and every line is optional — answer what you like and leave the rest. The app works without any of this. It just has to guess.':
    'পাঁচটা ছোট ধাপ, আর প্রতিটি লাইনই ইচ্ছেমতো ছেড়ে দেওয়া যায় — যেটা চান উত্তর দিন, বাকিটা থাক। এসবের কিছু না দিলেও অ্যাপ চলে। তখন তাকে শুধু অনুমান করতে হয়।',
  'Which language do you read?': 'আপনি কোন ভাষা পড়েন?',
  'Changes the app to that language and tells the district which one to write and call in. Every screen switches, including this one — tap and see.':
    'অ্যাপটা ওই ভাষায় বদলে যায়, আর জেলা প্রশাসন জেনে যায় কোন ভাষায় চিঠি লিখতে আর ফোন করতে হবে। এই স্ক্রিন সমেত সব স্ক্রিন বদলায় — চাপ দিয়ে দেখুন।',
  'What happens to this': 'এই তথ্যের কী হয়',
  'Kept on this phone and with the district authority. Not sold, not shared with anyone else, and deleted after two years unless you look at it again. You can change or delete it from Settings whenever you like.':
    'এই ফোনে আর জেলা প্রশাসনের কাছে থাকে। বিক্রি করা হয় না, আর কারও সঙ্গে ভাগ করা হয় না, আর আপনি আবার না দেখলে দুই বছর পরে মুছে যায়। সেটিংস থেকে যখন চান বদলাতে বা মুছতে পারেন।',
  'This phone will not give the app a lasting identity, so these answers will not come back if you reinstall it. Everything else works normally.':
    'এই ফোন অ্যাপকে স্থায়ী কোনও পরিচয় দেবে না, তাই অ্যাপ আবার বসালে এই উত্তরগুলো ফিরে আসবে না। বাকি সব ঠিকঠাক চলবে।',
  'Where should help go?': 'সাহায্য কোথায় যাবে?',
  'Name of one adult here': 'এখানে থাকা একজন বড়দের নাম',
  'e.g. Ruma Das': 'যেমন রুমা দাস',
  'So a responder can ask for someone by name at the door instead of shouting.':
    'যাতে উদ্ধারকারী দরজায় এসে চিৎকার না করে নাম ধরে কাউকে ডাকতে পারেন।',
  'Ward number': 'ওয়ার্ড নম্বর',
  'e.g. 58': 'যেমন 58',
  'Alerts are ranked by ward, which makes this the most useful line on the form.':
    'সতর্কতা ওয়ার্ড ধরে সাজানো হয়, তাই এই ফর্মে এই লাইনটাই সবচেয়ে কাজের।',
  Address: 'ঠিকানা',
  'House, lane, nearest landmark': 'বাড়ি, গলি, সবচেয়ে কাছের চেনা জায়গা',
  'Plain directions beat a map pin. Write it the way you would tell a neighbour, not the way a form wants it.':
    'ম্যাপের চিহ্নের চেয়ে সোজা ভাষায় পথ বলা ভালো। প্রতিবেশীকে যেভাবে বলতেন সেভাবে লিখুন, ফর্ম যেভাবে চায় সেভাবে নয়।',
  'Who lives here?': 'এখানে কে কে থাকেন?',
  'People in the house': 'বাড়িতে কত জন',
  'Everyone who sleeps here tonight, children included.':
    'আজ রাতে যারা এখানে ঘুমোবেন সবাই, ছোটরাও।',
  'Is the house yours?': 'বাড়িটা কি আপনার?',
  'We own it': 'আমাদের নিজের',
  'We rent it': 'ভাড়ায় থাকি',
  'Something else': 'অন্য কিছু',
  'Staying with family, staff quarters, or no fixed home':
    'আত্মীয়ের বাড়িতে, কাজের জায়গার ঘরে, বা পাকা কোনও বাড়ি নেই',
  'It tells the district who has a house to return to once the water drops. It changes what help you are offered, never whether you get any.':
    'জল নামলে কার ফেরার বাড়ি আছে, এতে জেলা প্রশাসন সেটা জানে। এতে আপনাকে কী ধরনের সাহায্য দেওয়া হবে তা বদলায়, সাহায্য পাবেন কি না তা কখনও নয়।',
  'Who would need help getting out?': 'বেরোতে কার সাহায্য দরকার হবে?',
  'These lines count the same {who} over again, so they are not meant to add up. Someone over sixty who also cannot swim belongs in two of them. Count them in both.':
    'এই লাইনগুলো ওই একই {who}-কেই বারবার গোনে, তাই যোগ করে মেলানোর কথা নয়। ষাটের বেশি বয়সের কেউ যদি সাঁতারও না জানেন, তিনি দুটো লাইনেই পড়েন। দুটোতেই গুনুন।',
  'Aged 60 or over': 'বয়স 60 বা তার বেশি',
  'Slower on a flooded road, and first onto a boat.':
    'জল জমা রাস্তায় হাঁটা ধীর, আর নৌকায় আগে ওঠার কথা।',
  'Under two years old': 'বয়স দুই বছরের কম',
  'Carried, not walked. It changes which shelter is right.':
    'কোলে যাবে, হেঁটে নয়। এতে কোন আশ্রয়কেন্দ্র ঠিক হবে তা বদলায়।',
  Pregnant: 'গর্ভবতী',
  'Cannot leave the house unaided': 'সাহায্য ছাড়া বাড়ি থেকে বেরোতে পারেন না',
  'A wheelchair, a stretcher, or anyone who cannot manage stairs alone.':
    'হুইলচেয়ার, স্ট্রেচার, বা একা সিঁড়ি ভাঙতে পারেন না এমন যে কেউ।',
  'One person lives here, so every line above is 0 or 1. Go back a step to change that.':
    'এখানে একজন থাকেন, তাই উপরের প্রতিটি লাইন 0 বা 1। বদলাতে এক ধাপ পিছনে যান।',
  'Each line stops at {n}, the number you gave a step ago.':
    'প্রতিটি লাইন {n}-এ গিয়ে থামে, এক ধাপ আগে আপনি এই সংখ্যাটাই দিয়েছিলেন।',
  'Two things that change the advice': 'দুটো জিনিস, যা পরামর্শ বদলে দেয়',
  'Cannot swim': 'সাঁতার জানেন না',
  'Above zero, nobody here is told to wade a flooded lane, however short the route looks.':
    'শূন্যের বেশি হলে এই বাড়ির কাউকে জল জমা গলি ভেঙে যেতে বলা হয় না, পথ যত ছোটই দেখাক।',
  'Animals here': 'এখানে কোনও পশুপাখি',
  'e.g. 2 goats, 6 hens': 'যেমন 2টি ছাগল, 6টি মুরগি',
  'People die refusing to leave animals behind. Told about them, a plan can include them instead of arguing at the door.':
    'পশুপাখি ছেড়ে যেতে রাজি না হয়ে মানুষ মারা যান। আগে থেকে জানা থাকলে দরজায় দাঁড়িয়ে তর্ক না করে পরিকল্পনাতেই তাদের ধরা যায়।',
  // The restore offer, shown after a reinstall. Spoken in the language the profile
  // itself carries, so a household on record as reading Bengali is greeted in it.
  'We still have your details': 'আপনার তথ্য আমাদের কাছে এখনও আছে',
  'Last confirmed {when}': 'শেষ নিশ্চিত করা হয়েছে {when}',
  'at some point': 'কোনও এক সময়ে',
  'on {day} {month} {year}': '{year} সালের {day} {month}',
  'Ward {n}': 'ওয়ার্ড {n}',
  '{n} person in the house': 'বাড়িতে {n} জন',
  '{n} people in the house': 'বাড়িতে {n} জন',
  'This phone had a household profile on the district\'s records, and it is still there. You do not have to type it again.':
    'জেলা প্রশাসনের খাতায় এই ফোনের নামে বাড়ির তথ্য ছিল, আর সেটা এখনও আছে। আবার লিখতে হবে না।',
  'Go through the questions if any of it has changed, or if this phone is not yours — answering again replaces what is above.':
    'কিছু বদলে গেলে, বা এই ফোন আপনার না হলে প্রশ্নগুলোয় যান — আবার উত্তর দিলে উপরের তথ্যের জায়গায় নতুনটা বসবে।',
  'Use these details': 'এই তথ্যগুলোই ব্যবহার করুন',
  'Go through the questions': 'প্রশ্নগুলোয় যান',

  // Gregorian months. Not the Bengali calendar — a date the district confirmed is a
  // Gregorian one, and Boishakh here would move a stale profile by two weeks.
  January: 'জানুয়ারি',
  February: 'ফেব্রুয়ারি',
  March: 'মার্চ',
  April: 'এপ্রিল',
  May: 'মে',
  June: 'জুন',
  July: 'জুলাই',
  August: 'অগস্ট',
  September: 'সেপ্টেম্বর',
  October: 'অক্টোবর',
  November: 'নভেম্বর',
  December: 'ডিসেম্বর',
  // BENGALI-NEXT
};

/**
 * Hindi.
 *
 * Kolkata's second language rather than its first, and the register is different
 * for it: plainer Hindustani over Sanskritised Hindi, because the reader is more
 * likely a migrant worker from Bihar or Jharkhand than a Delhi office. So ऊँची जगह
 * rather than उच्च भूमि, and आग rather than अग्नि.
 *
 * The आप imperative throughout, same reason as the Bengali.
 *
 * NOT REVIEWED BY A NATIVE SPEAKER. See TRANSLATIONS_REVIEWED.
 */
const HINDI: Record<string, string> = {
  'Move to higher ground now. Do not try to drive through standing water.':
    'अभी ऊँची जगह पर चले जाएँ। भरे पानी में गाड़ी चलाने की कोशिश न करें।',
  'Walk to the nearest shelter now. Take your phone, medicines and ID.':
    'अभी सबसे नज़दीकी शरण-स्थल तक पैदल जाएँ। फ़ोन, दवाइयाँ और पहचान-पत्र साथ लें।',
  'Pack a bag you can carry and stay off low-lying roads.':
    'एक बैग तैयार रखें जो आप ख़ुद उठा सकें, और नीची सड़कों से दूर रहें।',
  'No action needed yet. Check back if the rain gets heavier.':
    'अभी कुछ करने की ज़रूरत नहीं। बारिश तेज़ हो तो फिर देख लें।',
  'Leave now and move upwind, away from the smoke. Close doors behind you.':
    'अभी निकलें और धुएँ से उल्टी दिशा में, जिधर से हवा आ रही है उधर जाएँ। पीछे दरवाज़े बंद करते जाएँ।',
  'Leave if you can smell smoke. Do not wait to see flames.':
    'धुएँ की गंध आते ही निकल जाएँ। आग दिखने का इंतज़ार न करें।',
  'Clear dry leaves and fuel from around your home. Keep your phone charged.':
    'घर के चारों तरफ़ से सूखे पत्ते और जलने वाला सामान हटा दें। फ़ोन चार्ज रखें।',
  'No action needed yet. Avoid open fires and cooking outdoors.':
    'अभी कुछ करने की ज़रूरत नहीं। खुली आग और बाहर खाना पकाने से बचें।',

  Monitor: 'नज़र रखें',
  Prepare: 'तैयार रहें',
  'Act now': 'अभी क़दम उठाएँ',
  'Leave now': 'अभी निकलें',

  Evacuate: 'निकल जाएँ',
  'Move to shelter': 'शरण-स्थल जाएँ',
  'Get ready': 'तैयार रहें',
  'Stay aware': 'सतर्क रहें',

  Flooding: 'बाढ़',
  Fire: 'आग',
  Flood: 'बाढ़',
  'Water rising fast in {place}': '{place} में पानी तेज़ी से बढ़ रहा है',
  'Flooding likely in {place}': '{place} में बाढ़ की आशंका',
  'Water levels climbing in {place}': '{place} में जलस्तर बढ़ रहा है',
  'Heavy rain in {place}': '{place} में भारी बारिश',
  'Fire spreading near {place}': '{place} के पास आग फैल रही है',
  'Fire detected near {place}': '{place} के पास आग लगी है',
  'Fire risk high near {place}': '{place} के पास आग का ख़तरा ज़्यादा है',
  'Dry conditions near {place}': '{place} के पास सूखा मौसम',

  'the Sundarbans edge': 'सुंदरबन का किनारा',
  'Rabindra Sarobar': 'रवींद्र सरोबर',
  'Howrah Bridge': 'हावड़ा ब्रिज',
  'Salt Lake': 'साल्ट लेक',
  'New Town': 'न्यू टाउन',
  Jadavpur: 'जादवपुर',

  '{distance} away, in your area': '{distance} दूर, आपके इलाक़े में ही',
  '{distance} away': '{distance} दूर',
  '{distance} away, not in your area': '{distance} दूर, आपके इलाक़े में नहीं',

  '{hazard} warning, critical. Leave now.':
    '{hazard} की चेतावनी, गंभीर। अभी निकलें।',
  '{hazard} warning, high. Move to a shelter.':
    '{hazard} की चेतावनी, तेज़। शरण-स्थल चले जाएँ।',
  '{hazard} watch, medium. Get ready.':
    '{hazard} पर नज़र, मध्यम। तैयार रहें।',
  '{hazard} notice, low. Stay aware.': '{hazard} की सूचना, कम। सतर्क रहें।',

  'At capacity. Do not go here.': 'जगह नहीं है। यहाँ न जाएँ।',
  'Closed. Do not go here.': 'बंद है। यहाँ न जाएँ।',
  'Only {free} place free — not enough for all {people} of you.':
    'सिर्फ़ {free} जगह ख़ाली — आप {people} लोगों के लिए काफ़ी नहीं।',
  'Only {free} places free — not enough for all {people} of you.':
    'सिर्फ़ {free} जगह ख़ाली — आप {people} लोगों के लिए काफ़ी नहीं।',
  'On higher ground, {metres} m above the local datum.':
    'ऊँची जगह पर, स्थानीय स्तर से {metres} मीटर ऊपर।',
  'The closest shelter still taking people.':
    'सबसे नज़दीकी शरण-स्थल जहाँ अभी भी लोग लिए जा रहे हैं।',
  'Room for all {people} of you, {free} places free.':
    'आप {people} लोगों की जगह है, {free} जगह ख़ाली।',
  '{free} places free.': '{free} जगह ख़ाली।',
  'Full, {capacity} people inside': 'भरा हुआ, अंदर {capacity} लोग',
  'Nearly full, {free} places left': 'लगभग भरा, {free} जगह बची',
  '{free} of {capacity} places free': '{capacity} में से {free} जगह ख़ाली',
  'No open shelter has room for all {people} of you. This is the best of them, with {free} place free — go together and ask at the desk.':
    'किसी भी खुले शरण-स्थल में आप {people} लोगों की जगह नहीं है। इनमें यही सबसे अच्छा है, {free} जगह ख़ाली — सब साथ जाएँ और डेस्क पर बात करें।',
  'No open shelter has room for all {people} of you. This is the best of them, with {free} places free — go together and ask at the desk.':
    'किसी भी खुले शरण-स्थल में आप {people} लोगों की जगह नहीं है। इनमें यही सबसे अच्छा है, {free} जगह ख़ाली — सब साथ जाएँ और डेस्क पर बात करें।',
  'This is the nearest shelter with room for {people}, but it is a long walk. Ask for a lift or a boat if you can.':
    '{people} लोगों की जगह वाला सबसे नज़दीकी शरण-स्थल यही है, लेकिन पैदल रास्ता लंबा है। हो सके तो गाड़ी या नाव का इंतज़ाम कर लें।',
  'No medical desk here. Bring any medicines you or the people with you take daily.':
    'यहाँ इलाज की व्यवस्था नहीं है। आप या साथ वालों की रोज़ की दवाइयाँ साथ ले जाएँ।',
  'Somebody in your house cannot swim. Do not wade, however short the stretch looks — half a metre of moving water takes an adult off their feet.':
    'आपके घर में कोई तैरना नहीं जानता। पानी कितना ही कम लगे, पैदल पार न करें — आधा मीटर बहता पानी बड़े आदमी को भी बहा ले जाता है।',

  'Surveyed on foot by the ward office.':
    'वार्ड ऑफ़िस ने ख़ुद पैदल चलकर देखा है।',
  'Worked out from a street map, routed around the marked zones. Nobody has walked it, so trust your eyes at every turn.':
    'सड़क के नक़्शे से निकाला गया, चिह्नित इलाक़ों से बचाकर। कोई ख़ुद चलकर नहीं देखा, इसलिए हर मोड़ पर अपनी आँखों पर भरोसा करें।',

  '{n} m': '{n} मी',
  '{n} km': '{n} किमी',
  'just now': 'अभी-अभी',
  '{n} min ago': '{n} मिनट पहले',
  '{n} hour ago': '{n} घंटा पहले',
  '{n} hours ago': '{n} घंटे पहले',
  '{n} day ago': '{n} दिन पहले',
  '{n} days ago': '{n} दिन पहले',
  '{n} minutes': '{n} मिनट',
  '{n} hour': '{n} घंटा',
  '{n} hours': '{n} घंटे',
  '{n} min': '{n} मिनट',
  '{n} day': '{n} दिन',
  '{n} days': '{n} दिन',

  north: 'उत्तर',
  'north-east': 'उत्तर-पूर्व',
  east: 'पूर्व',
  'south-east': 'दक्षिण-पूर्व',
  south: 'दक्षिण',
  'south-west': 'दक्षिण-पश्चिम',
  west: 'पश्चिम',
  'north-west': 'उत्तर-पश्चिम',

  'Issued {when}': '{when} जारी हुई',
  'Walk to {shelter}': '{shelter} तक पैदल जाएँ',
  '{distance}, about {minutes} min on foot':
    '{distance}, पैदल लगभग {minutes} मिनट',
  'I have seen this': 'मैंने देख लिया',
  'Stops the alarm. The warning stays active.':
    'सायरन बंद हो जाएगा। चेतावनी चालू रहेगी।',
  // The feed: how it is grouped, and what an empty one says.
  // ---------------------------------------------------------------------------
  'Opens what to do about this alert':
    'इस चेतावनी पर क्या करना है, वह दिखाता है',
  '{stance}. Tap for directions and what to take.':
    '{stance}। रास्ता और साथ क्या लेना है, जानने के लिए टैप करें।',
  'Also near you': 'आपके पास और भी',
  'Within {km} km': '{km} किमी के भीतर',
  'Elsewhere in the district': 'ज़िले में कहीं और',
  'Not in your area': 'आपके इलाक़े में नहीं',
  'Checked at {time}. Pull down to check again.':
    '{time} पर देखा गया। दोबारा देखने के लिए नीचे खींचें।',
  'No active alerts near you': 'आपके पास अभी कोई चेतावनी नहीं',
  'Nothing is affecting {locality} right now. Sensors are still reporting, and this screen will change on its own if that stops being true.':
    '{locality} में अभी कोई दिक़्क़त नहीं है। सेंसर चालू हैं, और हालत बदली तो यह स्क्रीन ख़ुद बदल जाएगी।',
  'Last checked {time}': 'आख़िरी बार देखा {time}',

  // The detail screen: its headings, its two buttons, and the bag to pack.
  // ---------------------------------------------------------------------------
  Alerts: 'चेतावनियाँ',
  'What to do': 'क्या करें',
  'See the zone on the map': 'नक़्शे पर इलाक़ा देखें',
  'Which way it is going': 'किस तरफ़ जा रहा है',
  'Take with you': 'साथ क्या लें',
  'Why you are seeing this': 'यह क्यों दिख रहा है',
  'Phone and charger, or a power bank': 'फ़ोन और चार्जर, या एक पावर बैंक',
  'Any medicines you take daily': 'रोज़ जो दवाइयाँ लेते हैं',
  'Aadhaar or another ID, and some cash':
    'आधार या कोई और पहचान-पत्र, और कुछ नक़द',
  'Drinking water, and a torch if you have one':
    'पीने का पानी, और टॉर्च हो तो वह भी',
  'Leave everything else. Things can be replaced.':
    'बाक़ी सब छोड़ दें। सामान दोबारा मिल जाएगा।',
  // Which way the sensor is going. `smoke` is धुएँ and `Smoke` is धुआँ — the
  // oblique goes inside "{what} का सेंसर", the nominative stands alone on a tile.
  // ---------------------------------------------------------------------------
  '{span} ago': '{span} पहले',
  now: 'अब',
  water: 'पानी',
  rainfall: 'बारिश',
  smoke: 'धुएँ',
  'Holding steady. The {what} sensor has sat near {latest}% of its range for the last {span}.':
    'एक जैसा है। पिछले {span} से {what} का सेंसर अपने पैमाने के {latest}% के आसपास ही है।',
  'Still rising. The {what} sensor has gone from {from}% to {latest}% of its range in the last {span}.':
    'अभी भी बढ़ रहा है। पिछले {span} में {what} का सेंसर अपने पैमाने के {from}% से {latest}% तक पहुँच गया।',
  'Falling back. The {what} sensor has gone from {from}% to {latest}% of its range in the last {span}.':
    'कम होने लगा है। पिछले {span} में {what} का सेंसर अपने पैमाने के {from}% से {latest}% पर आ गया।',
  'At this rate that is {points} more points of range every hour.':
    'इस रफ़्तार से हर घंटे पैमाने के {points} पॉइंट और।',
  "Percentage of the sensor's full range, not a depth. Nobody has calibrated these nodes against a staff gauge, so this app will not put a number in centimetres on it.":
    'यह सेंसर के पूरे पैमाने का प्रतिशत है, पानी की गहराई नहीं। इन नोड्स को किसी मापक से मिलाकर नहीं देखा गया, इसलिए यह ऐप सेंटीमीटर में कोई आँकड़ा नहीं देगा।',

  // The evidence, and the tiles above it. 4095 stays in Latin digits.
  // ---------------------------------------------------------------------------
  'Water sensor is at {pct}% of full scale ({raw} of 4095).':
    'पानी का सेंसर पूरे पैमाने का {pct}% दिखा रहा है (4095 में से {raw})।',
  'Rainfall sensor is at {pct}%.': 'बारिश का सेंसर {pct}% दिखा रहा है।',
  'Humidity is {pct}%.': 'हवा में नमी {pct}% है।',
  'The flame sensor is triggered.': 'आग का सेंसर चालू हो गया है।',
  'Temperature is {c}°C.': 'तापमान {c}°से।',
  'Smoke sensor is at {pct}% of full scale ({raw} of 4095).':
    'धुएँ का सेंसर पूरे पैमाने का {pct}% दिखा रहा है (4095 में से {raw})।',
  'This warning was issued by the district authority rather than by a sensor reading.':
    'यह चेतावनी किसी सेंसर की रीडिंग से नहीं, ज़िला प्रशासन की तरफ़ से दी गई है।',

  'Water level': 'जलस्तर',
  Rainfall: 'बारिश',
  Humidity: 'नमी',
  'Flame sensor': 'आग का सेंसर',
  Smoke: 'धुआँ',
  Temperature: 'तापमान',
  Triggered: 'चालू',
  Clear: 'कुछ नहीं',

  'Reported by {node}': 'बताया {node} ने',
  '{hazard} sensor, {kind} node, {status}':
    '{hazard} सेंसर, {kind} नोड, {status}',
  'Recorded at {time}': '{time} पर दर्ज हुआ',
  // Severity as a bare adjective, for the row that says which zone you are in.
  // Lowercase keys on purpose: these sit inside a sentence, and the capitalised
  // 'Flood' / 'Fire' above are a different job.
  low: 'कम',
  medium: 'मध्यम',
  high: 'तेज़',
  critical: 'गंभीर',

  // SOS. The word SOS itself is never in here — see the note in Sos.tsx.
  // ---------------------------------------------------------------------------
  'Emergency SOS': 'आपातकालीन SOS',
  'Sends your location to the district control room and to your emergency contacts. Use it when you need someone to come to you.':
    'आप कहाँ हैं यह ज़िला कंट्रोल रूम और आपके आपात नंबरों पर भेजता है। जब किसी को आपके पास आना ज़रूरी हो, तब इसे दबाएँ।',
  'Send emergency SOS': 'आपातकालीन SOS भेजें',
  'Hold for three seconds to send': 'भेजने के लिए तीन सेकंड दबाकर रखें',
  Sending: 'भेजा जा रहा है',
  'Reaching the control room': 'कंट्रोल रूम तक पहुँचाया जा रहा है',
  'Keep holding': 'दबाए रखें',
  'Hold for 3 seconds': '3 सेकंड दबाकर रखें',
  'Nothing was sent — you let go early. Hold until the count reaches zero.':
    'कुछ नहीं भेजा गया — आपने पहले ही छोड़ दिया। गिनती शून्य तक पहुँचने तक दबाए रखें।',
  'The hold is deliberately slow so this cannot happen in your pocket.':
    'दबाकर रखने का समय जान-बूझकर लंबा रखा गया है, ताकि जेब में यह अपने आप न चल जाए।',
  'No signal right now': 'अभी कोई सिग्नल नहीं है',
  'Your SOS will be saved and sent the moment your phone finds a network. Nobody has it yet. A text message gets through on a tower that cannot carry anything else — send one below, and call 112 if you can.':
    'आपका SOS सहेज लिया जाएगा और फ़ोन को नेटवर्क मिलते ही चला जाएगा। अभी यह किसी तक नहीं पहुँचा है। जो टावर और कुछ नहीं ढो पाता, उस पर भी एक टेक्स्ट मैसेज निकल जाता है — नीचे से एक भेजें, और हो सके तो 112 पर फ़ोन करें।',
  // What the SOS carries. Read by somebody deciding whether to hold the button,
  // so it is written as a list of facts and not as reassurance.
  'What gets sent': 'क्या-क्या भेजा जाएगा',
  'Your location': 'आप कहाँ हैं',
  Coordinates: 'अक्षांश-देशांतर',
  '{lat}, {lng} within {accuracy} m': '{lat}, {lng} — {accuracy} मीटर के भीतर',
  'Hazard at your location': 'आपकी जगह पर क्या ख़तरा है',
  '{zone}, marked {severity}': '{zone}, {severity} के तौर पर चिह्नित',
  'No marked zone at your location': 'आपकी जगह पर कोई चिह्नित इलाक़ा नहीं है',
  'Who is in the house': 'घर में कौन-कौन है',
  'Not recorded — the questions in Settings add this':
    'दर्ज नहीं है — सेटिंग्स में उन सवालों के जवाब देने पर यह जुड़ जाएगा',
  'Your phone number': 'आपका फ़ोन नंबर',
  'From your SIM': 'आपके सिम से',

  // The household line under it.
  '{n} person': '{n} व्यक्ति',
  '{n} people': '{n} लोग',
  '{n} needing help to move': '{n} को हटाने में मदद चाहिए',
  '{n} who cannot swim': '{n} को तैरना नहीं आता',

  // The two other ways out: a voice call, and 140 bytes.
  'Call 112 instead': 'बजाय इसके 112 पर फ़ोन करें',
  '112 reaches police, fire and ambulance. Call it if you are hurt or trapped — a voice call gets a person, not a queue.':
    '112 से पुलिस, दमकल और एम्बुलेंस — तीनों मिलते हैं। चोट लगी हो या कहीं फँस गए हों तो फ़ोन करें — फ़ोन पर सीधे एक आदमी मिलता है, कतार नहीं।',
  'Send it as a text message': 'टेक्स्ट मैसेज के रूप में भेजें',
  'This phone has no messaging app to open. Nothing was sent.':
    'इस फ़ोन में खोलने के लिए कोई मैसेज ऐप नहीं है। कुछ नहीं भेजा गया।',
  'Opens your messages with everything above already written. Choose who to send it to — a relative, a neighbour, your ward councillor.':
    'ऊपर लिखी सारी बातें पहले से भरी हुई आपका मैसेज ऐप खुल जाएगा। किसे भेजना है, चुन लें — कोई रिश्तेदार, पड़ोसी, या आपका वार्ड पार्षद।',
  // The confirmation. 'सहेजा गया' against 'माँग ली गई है' is the whole
  // distinction the screen exists to make, and it must survive a glance.
  'Saved, not sent yet': 'सहेजा गया, अभी भेजा नहीं गया',
  'Help has been asked for': 'मदद माँग ली गई है',
  'Your phone has no signal. The SOS is stored and will go out by SMS as soon as a network appears. Nobody has been alerted yet.':
    'आपके फ़ोन में सिग्नल नहीं है। SOS सहेज लिया गया है, नेटवर्क आते ही SMS से चला जाएगा। अभी किसी को ख़बर नहीं गई है।',
  'The district control room has your location in {locality} and your emergency contacts have been messaged.':
    'ज़िला कंट्रोल रूम को पता है कि आप {locality} में हैं, और आपके आपात नंबरों पर भी ख़बर पहुँच गई है।',
  'Do not wait for this': 'इसके भरोसे बैठे न रहें',
  'If you are in danger now, move to higher ground or call 112 from a phone with signal.':
    'अगर आप अभी ख़तरे में हैं, तो ऊँची जगह पर चले जाएँ, या जिस फ़ोन में सिग्नल है उससे 112 पर फ़ोन करें।',
  'Keep your phone with you. The control room may call this number.':
    'फ़ोन अपने पास रखें। कंट्रोल रूम इसी नंबर पर फ़ोन कर सकता है।',
  'Back to alerts': 'चेतावनियों पर वापस',
  Done: 'हो गया',
  // The roll-call. The inverse of the button above it, and the one place in this
  // app where the app has to say plainly that it is telling somebody NOT to come.
  // ---------------------------------------------------------------------------
  'Tell the district you are safe': 'ज़िले को बताएँ कि आप सुरक्षित हैं',
  'Answer the household questions first. A message with no address adds a name to a list of unknowns instead of taking one off the search list.':
    'पहले घर के सवालों के जवाब दें। पता बताए बिना भेजी गई ख़बर से खोज-सूची से एक नाम कटता नहीं, उलटे अनजान लोगों की सूची में एक नाम जुड़ जाता है।',
  'Answer the questions': 'सवालों के जवाब दें',
  'The district has you marked safe': 'ज़िले के रिकॉर्ड में आप सुरक्षित हैं',
  'Reported at {time}, {ago}. Your house is not on the rescue list.':
    '{time} पर बताया गया, {ago}। आपका घर बचाव-सूची में नहीं है।',
  'Water rises again. If anything changes, take this back — nobody will think less of you for it.':
    'पानी दोबारा भी चढ़ता है। कुछ भी बदले तो इसे वापस ले लें — इसके लिए कोई आपको कम नहीं समझेगा।',
  'Telling them…': 'बताया जा रहा है…',
  'We need help after all': 'हमें मदद चाहिए',
  'If all {people} of you are somewhere safe and nobody needs help, this takes your house off the rescue list.':
    'अगर आप {people} लोग किसी सुरक्षित जगह पर हैं और किसी को मदद नहीं चाहिए, तो इससे आपका घर बचाव-सूची से हट जाएगा।',
  'If you are somewhere safe and do not need help, this takes your house off the rescue list.':
    'अगर आप किसी सुरक्षित जगह पर हैं और मदद नहीं चाहिए, तो इससे आपका घर बचाव-सूची से हट जाएगा।',
  'A search team will stop looking for this address. Only send this if everyone is accounted for.':
    'खोजी दल इस पते पर आना बंद कर देगा। सबका पता चल जाने पर ही यह भेजें।',
  'Yes, take us off the list': 'हाँ, हमें सूची से हटा दें',
  'Not yet': 'अभी नहीं',
  'We are safe': 'हम सुरक्षित हैं',
  'No answer from the district. Nothing has been reported — try again when you have a signal.':
    'ज़िले से कोई जवाब नहीं आया। कुछ भी नहीं बताया गया — सिग्नल मिलने पर दोबारा कोशिश करें।',
  'Your answers are still only on this phone, so there is no record to update. Nothing has been reported.':
    'आपके जवाब अभी सिर्फ़ इसी फ़ोन में हैं, इसलिए बदलने के लिए कोई रिकॉर्ड ही नहीं है। कुछ भी नहीं बताया गया।',
  'There are no household details to report. Nothing has been sent.':
    'बताने के लिए घर की कोई जानकारी नहीं है। कुछ नहीं भेजा गया।',
  // The walk. Chrome only — the turns themselves arrive from the ward office or
  // from a router and stay in the language they were written in.
  // ---------------------------------------------------------------------------
  Alert: 'चेतावनी',
  Open: 'खुला',
  Full: 'भरा',
  Closed: 'बंद',
  '{distance} left, about {minutes} min on foot':
    '{distance} और बाक़ी, पैदल करीब {minutes} मिनट',
  'This walk starts inside the flood zone':
    'यह पैदल रास्ता बाढ़ के इलाक़े के भीतर से ही शुरू होता है',
  'Go now rather than later, and turn back to higher ground if water reaches your knees.':
    'बाद में नहीं, अभी निकलें — और पानी घुटनों तक आ जाए तो ऊँची जगह की ओर लौट जाएँ।',
  Then: 'उसके बाद',
  'Step {n} of {total}': '{total} में से {n}वाँ क़दम',
  'I have arrived': 'मैं पहुँच गया',
  'Done, next step': 'हो गया, अगला क़दम',
  'Other shelters': 'दूसरे आश्रय',
  'Pick a different one if this route looks wrong to you. You know your streets better than we do.':
    'यह रास्ता आपको ग़लत लगे तो कोई दूसरा चुन लें। अपनी गलियाँ आप हमसे बेहतर जानते हैं।',
  '{shelter}, {distance} away, {status}': '{shelter}, {distance} दूर, {status}',
  '{distance}, {minutes} min walk': '{distance}, पैदल {minutes} मिनट',
  'You have reached {shelter}': 'आप {shelter} पहुँच गए हैं',
  'Find a volunteer or an official at the entrance and give them your name so the district knows you are safe.':
    'गेट पर किसी स्वयंसेवक या सरकारी कर्मचारी को ढूँढकर अपना नाम बता दें, ताकि ज़िले को पता चल जाए कि आप सुरक्षित हैं।',
  // The compass fallback, for when nobody has surveyed the walk and the router
  // could not be asked. A heading, said out loud as a heading.
  'Direction only': 'सिर्फ़ दिशा',
  'Head {heading}': '{heading} की ओर चलें',
  'That is the straight-line direction. Streets will not run that way, so keep to the main road that carries you {heading} and ask a police officer or a volunteer if you lose it.':
    'यह सीधी रेखा की दिशा है। सड़कें ठीक उसी ओर नहीं जाएँगी, इसलिए जो बड़ी सड़क आपको {heading} की ओर ले जा रही है उसी पर बने रहें, और रास्ता भटक जाएँ तो किसी पुलिसवाले या स्वयंसेवक से पूछ लें।',
  'No walking route avoids the water': 'पानी से बचकर जाने वाला कोई पैदल रास्ता नहीं है',
  'Every way out of here crosses a marked zone. Do not wade to follow the direction below. Call 112 and ask for a boat, and move to the highest floor you can reach while you wait.':
    'यहाँ से निकलने का हर रास्ता किसी चिह्नित इलाक़े से होकर जाता है। नीचे दी दिशा पकड़कर पानी में उतरने की कोशिश न करें। 112 पर फ़ोन करके नाव माँगें, और इंतज़ार के दौरान जितनी ऊँची मंज़िल तक जा सकें, चले जाएँ।',
  'Walk to this address': 'इस पते तक पैदल जाएँ',
  'Nobody has surveyed the walk to this shelter. We are asking a street map for one now — the direction above holds either way.':
    'इस आश्रय तक का पैदल रास्ता किसी ने चलकर नहीं देखा है। अभी सड़क के नक़्शे से एक रास्ता पूछा जा रहा है — ऊपर दी दिशा दोनों हालत में सही रहेगी।',
  "We only have step-by-step directions for some shelters. Rather than show you another shelter's streets, we are giving you the direction and the address for this one.":
    'क़दम-दर-क़दम रास्ता सिर्फ़ कुछ ही आश्रयों के लिए है। किसी और आश्रय की गलियाँ दिखाने के बजाय हम इसी की दिशा और पता दे रहे हैं।',
  // How much to trust the screen.
  // ---------------------------------------------------------------------------
  'Live. Updated {time}.': 'सीधा। {time} पर अपडेट हुआ।',
  'No signal. Showing what we saved at {time}.':
    'सिग्नल नहीं है। {time} पर जो सहेजा था, वही दिखा रहे हैं।',
  'No signal for {span}. These numbers may be out of date.':
    '{span} से सिग्नल नहीं है। ये आँकड़े पुराने हो सकते हैं।',
  'No signal and nothing saved yet. Call 112 for emergencies.':
    'सिग्नल नहीं है, और सहेजा हुआ भी कुछ नहीं। किसी आपात स्थिति में 112 पर फ़ोन करें।',
  'Try to reconnect': 'फिर से जोड़ने की कोशिश करें',
  Trying: 'कोशिश जारी',
  Retry: 'फिर से',
  // The empty feed. 'यह सब ठीक होने की ख़बर नहीं है' is the sentence that has to
  // survive being skimmed — it is the whole reason the card is not blank.
  // ---------------------------------------------------------------------------
  'Checking for alerts': 'चेतावनियाँ देखी जा रही हैं',
  'Reading the district sensor network for {locality}. This usually takes a moment on a normal connection and longer on a weak one.':
    '{locality} के लिए ज़िले के सेंसर पढ़े जा रहे हैं। नेट ठीक हो तो एक पल, कमज़ोर हो तो कुछ देर लगती है।',
  'If it does not load, this screen will say so plainly rather than keep spinning.':
    'अगर नहीं आया, तो यह स्क्रीन घूमती नहीं रहेगी — साफ़ बता देगी।',
  'We could not check for alerts': 'चेतावनियाँ देखी नहीं जा सकीं',
  'There is no usable connection, so nothing on this screen is current. This is not an all-clear — a warning could be active for {locality} and this phone would not know.':
    'काम लायक़ नेट नहीं है, इसलिए इस स्क्रीन पर कुछ भी इस समय का नहीं है। यह सब ठीक होने की ख़बर नहीं है — {locality} के लिए कोई चेतावनी चालू हो सकती है और इस फ़ोन को पता नहीं चलेगा।',
  'For anything happening right now, call 112. Move to higher ground and away from water without waiting for this app.':
    'अभी जो हो रहा है उसके लिए 112 पर फ़ोन करें। इस ऐप का इंतज़ार किए बिना ऊँची जगह पर, पानी से दूर चले जाएँ।',
  'This build has no data source': 'इस बिल्ड में डेटा का कोई स्रोत नहीं है',
  'The app was compiled without the district database address, so it cannot receive alerts at all. This is not an all-clear and it will not fix itself.':
    'ऐप ज़िले के डेटाबेस के पते के बिना बना है, इसलिए इसे कोई चेतावनी मिलेगी ही नहीं। यह सब ठीक होने की ख़बर नहीं है, और यह अपने आप ठीक भी नहीं होगा।',
  'Whoever installed this build needs to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY and rebuild. Do not rely on this phone for warnings until then.':
    'जिसने यह बिल्ड इंस्टॉल किया है उसे EXPO_PUBLIC_SUPABASE_URL और EXPO_PUBLIC_SUPABASE_ANON_KEY डालकर दोबारा बिल्ड करना होगा। तब तक चेतावनियों के लिए इस फ़ोन पर भरोसा न करें।',
  'The alert service refused': 'चेतावनी सेवा ने जवाब नहीं दिया',
  'We reached the district system and it would not answer. This is not an all-clear — assume nothing about conditions in {locality}.':
    'ज़िले के सिस्टम तक पहुँच गए, पर उसने जवाब नहीं दिया। यह सब ठीक होने की ख़बर नहीं है — {locality} के हालात के बारे में कुछ भी मान न लें।',
  'This is a fault at our end, not on your phone. Trying again may work, but call 112 for anything urgent rather than waiting.':
    'ख़राबी हमारी तरफ़ है, आपके फ़ोन में नहीं। फिर से कोशिश करने पर हो सकता है, पर कुछ ज़रूरी हो तो इंतज़ार के बजाय 112 पर फ़ोन करें।',
  'No alert data': 'चेतावनी का कोई डेटा नहीं',
  'Nothing loaded, and we cannot tell you why. This is not an all-clear — assume nothing about conditions in {locality}.':
    'कुछ नहीं आया, और क्यों नहीं आया यह हम बता नहीं सकते। यह सब ठीक होने की ख़बर नहीं है — {locality} के हालात के बारे में कुछ भी मान न लें।',
  'For anything happening right now, call 112.':
    'अभी जो हो रहा है उसके लिए 112 पर फ़ोन करें।',
  'Checking…': 'देखा जा रहा है…',
  'Try again': 'फिर से कोशिश करें',
  // Am I in a marked zone right now.
  // ---------------------------------------------------------------------------
  'You are inside a {hazard} zone': 'आप {hazard} के चिह्नित इलाक़े में हैं',
  'You are outside all risk zones': 'आप किसी ख़तरे के चिह्नित इलाक़े में नहीं हैं',
  'No zones mapped here': 'यहाँ कोई इलाक़ा चिह्नित नहीं है',
  'Marked {severity} by the district authority.':
    'ज़िला प्रशासन ने इसे {severity} बताया है।',
  'Nearest marked zone is {distance} away.':
    'सबसे नज़दीक का चिह्नित इलाक़ा {distance} दूर है।',
  'No hazard zones have been mapped for this district yet, so there is nothing here to be outside of.':
    'इस ज़िले के लिए अभी कोई ख़तरे का इलाक़ा चिह्नित नहीं हुआ है, इसलिए यहाँ बाहर होने जैसा कुछ नहीं है।',
  'Location accurate to {n} m': 'आपकी जगह {n} मीटर तक सही',
  'Assumed location. This phone has not reported a fix.':
    'मानी हुई जगह। इस फ़ोन ने अभी अपनी जगह नहीं बताई है।',
  'You are inside {zone}, a {severity} {hazard} zone':
    'आप {zone} के अंदर हैं, यह {severity} {hazard} का इलाक़ा है',
  'You are outside all risk zones. Nearest is {distance} away':
    'आप किसी ख़तरे के चिह्नित इलाक़े में नहीं हैं। सबसे नज़दीक का {distance} दूर है',
  'No hazard zones have been mapped for this district yet':
    'इस ज़िले के लिए अभी कोई ख़तरे का इलाक़ा चिह्नित नहीं हुआ है',
  'Opens the zone map': 'इलाक़ों का नक़्शा खोलता है',

  // The tab bar. SOS is not here on purpose.
  Map: 'नक़्शा',
  Settings: 'सेटिंग्स',
  'Back to {destination}': '{destination} पर वापस जाएँ',
  // The map.
  // ---------------------------------------------------------------------------
  'Zone map': 'इलाक़ों का नक़्शा',
  'You are inside {zone}': 'आप {zone} के अंदर हैं',
  '{locality}, outside all marked zones':
    '{locality}, किसी चिह्नित इलाक़े के बाहर',
  '{distance} away, {minutes} min on foot':
    '{distance} दूर, पैदल {minutes} मिनट',
  'Walk here': 'यहाँ पैदल जाएँ',
  'This shelter is not taking people. Tap another marker to pick a different one.':
    'यह शरणस्थल अभी लोग नहीं ले रहा है। दूसरे निशान पर दबाकर कोई और चुनें।',
  'Flood zone': 'बाढ़ का इलाक़ा',
  'Fire zone': 'आग का इलाक़ा',
  'Shelter open': 'शरणस्थल खुला',
  'Full or closed': 'भरा या बंद',
  You: 'आप',
  'Zoom in': 'बड़ा करें',
  'Zoom out': 'छोटा करें',
  'Centre the map on my location': 'मैं जहाँ हूँ वहाँ नक़्शा लाएँ',
  'Show every zone and shelter in the district':
    'ज़िले के सारे इलाक़े और शरणस्थल दिखाएँ',
  'No street map in this build. Hazard geometry only.':
    'इस बिल्ड में सड़कों का नक़्शा नहीं है। सिर्फ़ ख़तरे के इलाक़े।',
  'Street map unreachable. Hazard geometry only.':
    'सड़कों का नक़्शा नहीं मिल रहा। सिर्फ़ ख़तरे के इलाक़े।',
  'Streets: {attribution}': 'सड़कें: {attribution}',
  'Loading the district map': 'ज़िले का नक़्शा आ रहा है',
  'No map data': 'नक़्शे का कोई डेटा नहीं',
  'Fetching hazard zones and shelters.':
    'ख़तरे के इलाक़े और शरणस्थल लाए जा रहे हैं।',
  'This build has no data source, so it has no zones or shelters to show. That is a fault in the build, not a sign the district is clear.':
    'इस बिल्ड में डेटा का कोई स्रोत नहीं है, इसलिए दिखाने के लिए न इलाक़े हैं न शरणस्थल। यह बिल्ड की ख़राबी है, इसका मतलब यह नहीं कि ज़िले में ख़तरा नहीं है।',
  'We could not load hazard zones or shelters. A blank map here does not mean the ground around you is safe — it means we do not know.':
    'ख़तरे के इलाक़े या शरणस्थल नहीं आ सके। यहाँ ख़ाली नक़्शे का मतलब यह नहीं कि आपके आसपास की ज़मीन सुरक्षित है — मतलब यह है कि हमें पता नहीं।',
  // The settings screen. See the Bengali block for why it stopped being English.
  // ---------------------------------------------------------------------------
  'BHOOMI-NETRA citizen alerts': 'BHOOMI-NETRA नागरिक चेतावनियाँ',
  'Push notifications': 'पुश नोटिफ़िकेशन',
  'On. Critical alerts for your ward will reach you with the screen off.':
    'चालू। आपके वार्ड की गंभीर चेतावनियाँ स्क्रीन बंद रहने पर भी आपके पास पहुँचेंगी।',
  'Not available in this build. You will only be alerted while the app is open.':
    'इस बिल्ड में नहीं है। ऐप खुला रहने पर ही आपको चेतावनी मिलेगी।',
  On: 'चालू',
  Unavailable: 'नहीं है',
  'Vibration for critical alerts': 'गंभीर चेतावनी पर कंपन',
  'On, and not switchable. A critical alert for the zone you are standing in is the one thing this app will not let you silence.':
    'चालू है, और बंद नहीं हो सकता। आप जिस इलाक़े में खड़े हैं उसकी गंभीर चेतावनी — यही एक चीज़ है जिसे यह ऐप आपको चुप नहीं कराने देगा।',
  'Test a critical alert': 'एक गंभीर चेतावनी आज़माएँ',
  'Plays the real vibration pattern and opens the takeover screen, so you know what it looks like before it matters.':
    'असली कंपन ही बजाता है और पूरी स्क्रीन वाली चेतावनी खोलता है, ताकि ज़रूरत पड़ने से पहले आप जान लें कि वह कैसी दिखती है।',
  // The connection row, and the four words the freshness state resolves to.
  Connection: 'कनेक्शन',
  'Simulate no signal': 'सिग्नल न होने जैसा करके देखें',
  'Review affordance, not a real setting. Turn it on to see how the app behaves offline. Data is currently {freshness}, last fetched {time}.':
    'यह असली सेटिंग नहीं, देख लेने का इंतज़ाम है। चालू करके देखिए कि सिग्नल के बिना ऐप कैसा चलता है। अभी का डेटा {freshness} है, आख़िरी बार {time} पर लिया गया।',
  live: 'सीधा',
  cached: 'सहेजा हुआ',
  stale: 'पुराना',
  offline: 'सिग्नल के बिना',

  About: 'ऐप के बारे में',
  'BHOOMI-NETRA watches river levels, rainfall, temperature, smoke and flame from sensor nodes across the district and warns the people nearest to a hazard first.':
    'BHOOMI-NETRA ज़िले भर के सेंसर नोड से नदी के पानी की ऊँचाई, बारिश, तापमान, धुएँ और आग पर नज़र रखता है, और ख़तरे के सबसे नज़दीक के लोगों को पहले चेताता है।',
  'It is not a substitute for emergency services. For anything happening right now, call 112.':
    'यह आपात सेवाओं की जगह नहीं ले सकता। अभी कुछ हो रहा हो तो 112 पर फ़ोन करें।',
  'Sensor data from the district node network. Zone boundaries and shelter status are set by the district authority.':
    'सेंसर का डेटा ज़िले के नोड नेटवर्क से। इलाक़ों की सीमाएँ और शरण-स्थलों की हालत ज़िला प्रशासन तय करता है।',
  // The location row. The coordinate pair stays in Latin digits.
  Location: 'जगह',
  '{coords}, accurate to {n} m. Fix taken {time}.':
    '{coords}, {n} मीटर तक सही। {time} पर लिया गया।',
  'This app cannot see your location, so it is working from a stated position near {place}. Zone and shelter answers may be about somewhere you are not.':
    'यह ऐप आपकी जगह नहीं देख पा रहा, इसलिए {place} के पास एक मानी हुई जगह से काम कर रहा है। इलाक़े और शरण-स्थल के जवाब ऐसी जगह के हो सकते हैं जहाँ आप नहीं हैं।',
  'Waiting for the first fix from this phone. Until it arrives the app is working from a stated position near {place}, so zone and shelter answers may be about somewhere you are not.':
    'इस फ़ोन से पहली बार जगह आने का इंतज़ार है। तब तक ऐप {place} के पास एक मानी हुई जगह से काम कर रहा है, इसलिए इलाक़े और शरण-स्थल के जवाब ऐसी जगह के हो सकते हैं जहाँ आप नहीं हैं।',
  'From this phone': 'इस फ़ोन से',
  Assumed: 'मानी हुई',
  'Open location permissions': 'जगह की अनुमति खोलें',
  'Allow location while using the app. Nothing is sent anywhere until you press SOS, and the app never tracks you with the screen off.':
    'ऐप चलाते समय जगह जानने की अनुमति दें। SOS दबाने तक कहीं कुछ नहीं भेजा जाता, और स्क्रीन बंद होने पर ऐप कभी आपका पीछा नहीं करता।',
  // The language group.
  Language: 'भाषा',
  'The whole app can be read in Bengali or Hindi: the alerts, the SOS screen, the walking directions, the household questions and this screen.':
    'पूरा ऐप बांग्ला या हिन्दी में पढ़ा जा सकता है: चेतावनियाँ, SOS की स्क्रीन, पैदल रास्ते के निर्देश, घर के लोगों के सवाल और यह स्क्रीन भी।',
  'The whole app is in this language: the alerts, the SOS screen, the walking directions, the household questions and this screen.':
    'पूरा ऐप इसी भाषा में है: चेतावनियाँ, SOS की स्क्रीन, पैदल रास्ते के निर्देश, घर के लोगों के सवाल और यह स्क्रीन भी।',
  'Not yet checked by a Bengali or Hindi speaker':
    'बांग्ला या हिन्दी जानने वाले किसी ने अभी देखा नहीं है',
  'Every line of this app was translated for this build and nobody has read it back against the English. If a warning reads oddly, trust the action and not the wording — switch to English to compare, and call 112 if you are unsure.':
    'इस ऐप की हर लाइन इस बिल्ड के लिए अनुवाद की गई है और अंग्रेज़ी से मिलाकर किसी ने पढ़ी नहीं है। कोई चेतावनी अटपटी लगे तो शब्दों पर नहीं, जो करने को कहा गया है उस पर भरोसा करें — मिलाने के लिए अंग्रेज़ी पर बदल लें, और शक हो तो 112 पर फ़ोन करें।',
  'Change the language': 'भाषा बदलें',
  'It is the first of the household questions, so it is kept with the rest of your details — the district writes and calls in the same language.':
    'घर के लोगों के सवालों में यह पहला है, इसलिए यह आपकी बाक़ी जानकारी के साथ ही रखा जाता है — ज़िला प्रशासन इसी भाषा में चिट्ठी लिखता और फ़ोन करता है।',
  // The household group.
  'Your household': 'आपके घर के लोग',
  'Not answered': 'जवाब नहीं दिया',
  'Nothing here tells the app who lives with you, so it assumes one person, no ward and nobody who needs help getting out. Five short steps changes that, and every line in them is optional.':
    'आपके साथ कौन रहता है, यह यहाँ कुछ नहीं बताता, इसलिए ऐप मान लेता है कि एक आदमी है, कोई वार्ड नहीं, और निकलने में किसी को मदद नहीं चाहिए। पाँच छोटे क़दम इसे बदल देते हैं, और उनमें हर लाइन छोड़ी जा सकती है।',
  'Answer the household questions': 'घर के लोगों के सवालों के जवाब दें',
  'ward {n}': 'वार्ड {n}',
  '{who}. On the district\'s records, last confirmed {when}.':
    '{who}। ज़िला प्रशासन के रिकॉर्ड में है, आख़िरी बार {when} पक्का किया गया।',
  '{who}. Saved on this phone {when} and not sent to the district yet.':
    '{who}। {when} इस फ़ोन में सहेजा गया, ज़िला प्रशासन तक अभी नहीं भेजा गया।',
  Saved: 'सहेजा हुआ है',
  'On record': 'रिकॉर्ड में है',
  'This phone only': 'सिर्फ़ इस फ़ोन में',
  'Send it to the district now': 'अभी ज़िला प्रशासन को भेजें',
  'Still no answer from the district\'s server. Your details are safe on this phone, and the app tries again every time it opens.':
    'ज़िला प्रशासन का सर्वर अभी भी जवाब नहीं दे रहा। आपकी जानकारी इस फ़ोन में सुरक्षित है, और ऐप हर बार खुलने पर फिर कोशिश करता है।',
  'Review or change these details': 'यह जानकारी देखें या बदलें',
  'Saving them again resets the two-year clock, so a look once a year is enough to stay on the list.':
    'फिर से सहेजने पर दो साल की गिनती नए सिरे से शुरू होती है, इसलिए सूची में बने रहने के लिए साल में एक बार देख लेना काफ़ी है।',
  'Delete from this phone': 'इस फ़ोन से मिटाएँ',
  'Tap again to delete from this phone': 'मिटाने के लिए एक बार और दबाएँ',
  'Clears the answers from this phone only. The district keeps its copy until it is two years old, and reinstalling will offer it back.':
    'जवाब सिर्फ़ इस फ़ोन से मिटते हैं। ज़िला प्रशासन के पास की नक़ल दो साल पुरानी होने तक रहती है, और ऐप फिर से लगाने पर उसे वापस लेने का विकल्प आएगा।',
  // The vulnerability counts, as a sentence.
  '{n} aged 60 or over': '{n} की उम्र 60 या उससे ऊपर',
  '{n} under two': '{n} की उम्र दो साल से कम',
  '{n} pregnant': '{n} गर्भवती',
  '{n} who cannot leave unaided': '{n} मदद के बिना नहीं निकल सकते',
  '{list} and {last}': '{list} और {last}',
  'On record: {list}.': 'रिकॉर्ड में: {list}।',
  // The household questions.
  // ---------------------------------------------------------------------------
  Back: 'पीछे',
  Cancel: 'रद्द करें',
  'Not now': 'अभी नहीं',
  Continue: 'आगे बढ़ें',
  'Save these details': 'यह जानकारी सहेजें',
  'Save what I have': 'जितना दिया है वही सहेजें',
  'Who is in your house?': 'आपके घर में कौन-कौन है?',
  'Check your details': 'अपनी जानकारी देख लें',
  'When water rises, a rescue team works from a list. If your house is on it they know how many people to plan for and who cannot walk out unaided. If it is not, they knock and hope.':
    'पानी चढ़ता है तो बचाव दल एक सूची के सहारे काम करता है। आपका घर उसमें हो तो उन्हें पता होता है कि कितने लोगों का इंतज़ाम करना है और कौन मदद के बिना पैदल नहीं निकल सकता। न हो तो वे दरवाज़ा खटखटाते हैं और उम्मीद करते हैं।',
  'Five short steps, and every line is optional — answer what you like and leave the rest. The app works without any of this. It just has to guess.':
    'पाँच छोटे क़दम, और हर लाइन छोड़ी जा सकती है — जो चाहें बताएँ, बाक़ी छोड़ दें। इसमें कुछ न दें तो भी ऐप चलता है। तब उसे बस अंदाज़ा लगाना पड़ता है।',
  'Which language do you read?': 'आप कौन-सी भाषा पढ़ते हैं?',
  'Changes the app to that language and tells the district which one to write and call in. Every screen switches, including this one — tap and see.':
    'ऐप उसी भाषा में बदल जाता है, और ज़िला प्रशासन को पता चल जाता है कि किस भाषा में चिट्ठी लिखनी और फ़ोन करना है। इस स्क्रीन समेत हर स्क्रीन बदलती है — दबाकर देखें।',
  'What happens to this': 'इस जानकारी का क्या होता है',
  'Kept on this phone and with the district authority. Not sold, not shared with anyone else, and deleted after two years unless you look at it again. You can change or delete it from Settings whenever you like.':
    'इस फ़ोन में और ज़िला प्रशासन के पास रहती है। बेची नहीं जाती, किसी और के साथ साझा नहीं की जाती, और आप फिर से न देखें तो दो साल बाद मिटा दी जाती है। सेटिंग्स से जब चाहें बदल या मिटा सकते हैं।',
  'This phone will not give the app a lasting identity, so these answers will not come back if you reinstall it. Everything else works normally.':
    'यह फ़ोन ऐप को कोई पक्की पहचान नहीं देगा, इसलिए ऐप फिर से लगाने पर ये जवाब वापस नहीं आएँगे। बाक़ी सब ठीक चलता रहेगा।',
  'Where should help go?': 'मदद कहाँ पहुँचे?',
  'Name of one adult here': 'यहाँ रहने वाले एक बड़े का नाम',
  'e.g. Ruma Das': 'जैसे रुमा दास',
  'So a responder can ask for someone by name at the door instead of shouting.':
    'ताकि बचाव कर्मी दरवाज़े पर चिल्लाने के बजाय किसी को नाम लेकर बुला सके।',
  'Ward number': 'वार्ड नंबर',
  'e.g. 58': 'जैसे 58',
  'Alerts are ranked by ward, which makes this the most useful line on the form.':
    'चेतावनियाँ वार्ड के हिसाब से क्रम में लगती हैं, इसलिए इस फ़ॉर्म में यही लाइन सबसे काम की है।',
  Address: 'पता',
  'House, lane, nearest landmark': 'घर, गली, सबसे नज़दीक की जानी-पहचानी जगह',
  'Plain directions beat a map pin. Write it the way you would tell a neighbour, not the way a form wants it.':
    'नक़्शे के निशान से सीधे-सादे रास्ते बेहतर हैं। जैसे पड़ोसी को बताते, वैसे लिखें, जैसे फ़ॉर्म चाहता है वैसे नहीं।',
  'Who lives here?': 'यहाँ कौन-कौन रहता है?',
  'People in the house': 'घर में कितने लोग',
  'Everyone who sleeps here tonight, children included.':
    'आज रात यहाँ सोने वाले सब, बच्चे भी।',
  'Is the house yours?': 'घर आपका है?',
  'We own it': 'अपना है',
  'We rent it': 'किराए पर हैं',
  'Something else': 'कुछ और',
  'Staying with family, staff quarters, or no fixed home':
    'रिश्तेदार के घर, काम की जगह के क्वार्टर में, या कोई पक्का घर नहीं',
  'It tells the district who has a house to return to once the water drops. It changes what help you are offered, never whether you get any.':
    'पानी उतरने पर किसके पास लौटने का घर है, इससे ज़िला प्रशासन यह जान पाता है। इससे आपको किस तरह की मदद दी जाएगी वह बदलता है, मदद मिलेगी या नहीं वह कभी नहीं।',
  'Who would need help getting out?': 'निकलने में किसे मदद चाहिए होगी?',
  'These lines count the same {who} over again, so they are not meant to add up. Someone over sixty who also cannot swim belongs in two of them. Count them in both.':
    'ये लाइनें उन्हीं {who} को बार-बार गिनती हैं, इसलिए इनका जोड़ मिलाने की ज़रूरत नहीं। साठ से ऊपर का कोई तैर भी न सकता हो तो वह दोनों में आता है। दोनों में गिनें।',
  'Aged 60 or over': 'उम्र 60 या उससे ऊपर',
  'Slower on a flooded road, and first onto a boat.':
    'पानी भरी सड़क पर चाल धीमी, और नाव पर पहले चढ़ाने वाले।',
  'Under two years old': 'उम्र दो साल से कम',
  'Carried, not walked. It changes which shelter is right.':
    'गोद में जाएँगे, पैदल नहीं। इससे बदलता है कि कौन-सा शरण-स्थल ठीक है।',
  Pregnant: 'गर्भवती',
  'Cannot leave the house unaided': 'मदद के बिना घर से नहीं निकल सकते',
  'A wheelchair, a stretcher, or anyone who cannot manage stairs alone.':
    'व्हीलचेयर, स्ट्रेचर, या कोई भी जो अकेले सीढ़ियाँ नहीं चढ़-उतर सकता।',
  'One person lives here, so every line above is 0 or 1. Go back a step to change that.':
    'यहाँ एक आदमी रहता है, इसलिए ऊपर की हर लाइन 0 या 1 है। बदलने के लिए एक क़दम पीछे जाएँ।',
  'Each line stops at {n}, the number you gave a step ago.':
    'हर लाइन {n} पर रुक जाती है, एक क़दम पहले आपने यही संख्या दी थी।',
  'Two things that change the advice': 'दो बातें, जो सलाह बदल देती हैं',
  'Cannot swim': 'तैरना नहीं आता',
  'Above zero, nobody here is told to wade a flooded lane, however short the route looks.':
    'शून्य से ऊपर हो तो इस घर के किसी को पानी भरी गली पार करने को नहीं कहा जाता, रास्ता कितना ही छोटा दिखे।',
  'Animals here': 'यहाँ कोई जानवर',
  'e.g. 2 goats, 6 hens': 'जैसे 2 बकरियाँ, 6 मुर्गियाँ',
  'People die refusing to leave animals behind. Told about them, a plan can include them instead of arguing at the door.':
    'जानवरों को छोड़कर जाने से इनकार करते हुए लोग मर जाते हैं। पहले से पता हो तो दरवाज़े पर बहस करने के बजाय योजना में ही उन्हें शामिल किया जा सकता है।',
  // The restore offer, shown after a reinstall.
  'We still have your details': 'आपकी जानकारी हमारे पास अब भी है',
  'Last confirmed {when}': 'आख़िरी बार {when} पक्का किया गया',
  'at some point': 'किसी समय',
  'on {day} {month} {year}': '{day} {month} {year} को',
  'Ward {n}': 'वार्ड {n}',
  '{n} person in the house': 'घर में {n} आदमी',
  '{n} people in the house': 'घर में {n} लोग',
  'This phone had a household profile on the district\'s records, and it is still there. You do not have to type it again.':
    'ज़िला प्रशासन के रिकॉर्ड में इस फ़ोन के नाम घर की जानकारी थी, और वह अब भी है। दोबारा लिखने की ज़रूरत नहीं।',
  'Go through the questions if any of it has changed, or if this phone is not yours — answering again replaces what is above.':
    'कुछ बदल गया हो, या यह फ़ोन आपका न हो तो सवालों से गुज़रें — दोबारा जवाब देने पर ऊपर की जानकारी की जगह नई आ जाएगी।',
  'Use these details': 'यही जानकारी इस्तेमाल करें',
  'Go through the questions': 'सवालों से गुज़रें',

  // Gregorian months, in the spellings a Hindi reader expects on a form.
  January: 'जनवरी',
  February: 'फ़रवरी',
  March: 'मार्च',
  April: 'अप्रैल',
  May: 'मई',
  June: 'जून',
  July: 'जुलाई',
  August: 'अगस्त',
  September: 'सितंबर',
  October: 'अक्तूबर',
  November: 'नवंबर',
  December: 'दिसंबर',
  // HINDI-NEXT
};

export const DICTIONARY: Record<
  Exclude<Language, 'en'>,
  Record<string, string>
> = { bn: BENGALI, hi: HINDI };


