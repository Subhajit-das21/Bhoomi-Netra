/**
 * Assertions for the Phase 3 reasoning that decides something.
 *
 * Unlike scripts/check-map.js, which re-implements the projection arithmetic in
 * plain JS, this imports the real source. Node runs TypeScript directly now, so
 * there is no reason to test a copy of the logic — a copy is exactly what stops
 * agreeing with the original.
 *
 * The shelter roster and the user position below are the seeds from
 * 006_citizen_tables.sql and data/device.ts, so these are the recommendations a
 * reviewer will actually see on the device.
 */
const assert = require('assert');
const { registerHooks } = require('module');
const { existsSync } = require('fs');
const { fileURLToPath, pathToFileURL } = require('url');

/**
 * The app's own imports are extensionless — `from './geo'` — because Metro
 * resolves them. Node's ESM loader does not, so one resolve hook adds the `.ts`
 * back. The alternative was `.ts` extensions in the source, which would be a
 * change to the app to suit its test.
 */
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier)) {
      const guess = new URL(specifier, context.parentURL);
      if (existsSync(fileURLToPath(`${guess.href}.ts`))) {
        return next(`${specifier}.ts`, context);
      }
    }
    return next(specifier, context);
  },
});

async function main() {
  const { chooseShelter, needsOf, hasMedical, WALKABLE_LIMIT_M } = await import(
    '../src/domain/shelter.ts'
  );
  const { shelterReason, shelterCaveat, trendSentence, trendRate, routeSource } =
    await import('../src/domain/copy.ts');
  const { sensorTrend, thin, hazardTrend } = await import('../src/domain/trend.ts');
  const { distanceMetres, walkMinutes } = await import('../src/domain/geo.ts');
  const { emergencySmsBody, MAX_SMS_CHARS } = await import('../src/domain/sms.ts');
  const { avoidPolygons, directionsBody, orsFailure, parseOrsRoute } =
    await import('../src/domain/routing.ts');

  // -------------------------------------------------------------------------
  // The seeded roster, measured from Ward 58 the way CitizenProvider does
  // -------------------------------------------------------------------------
  const POSITION = { latitude: 22.5148, longitude: 88.361 };

  const SEED = [
    {
      id: 'b1c2d3e4-0001-4000-8000-000000000001',
      name: 'Deshapriya Park Community Hall',
      latitude: 22.5175, longitude: 88.3585,
      capacity: 400, occupancy: 186, status: 'open', elevation_metres: 7.5,
      facilities: ['Drinking water', 'Toilets', 'Medical desk', 'Phone charging'],
    },
    {
      id: 'b1c2d3e4-0002-4000-8000-000000000002',
      name: 'Lake Gardens Govt. High School',
      latitude: 22.506, longitude: 88.356,
      capacity: 250, occupancy: 244, status: 'full', elevation_metres: 6.5,
      facilities: ['Drinking water', 'Toilets'],
    },
    {
      id: 'b1c2d3e4-0003-4000-8000-000000000003',
      name: 'Netaji Indoor Stadium',
      latitude: 22.5636, longitude: 88.3395,
      capacity: 2000, occupancy: 410, status: 'open', elevation_metres: 6.0,
      facilities: ['Drinking water', 'Toilets', 'Medical desk', 'Cooked meals', 'Family rooms'],
    },
    {
      id: 'b1c2d3e4-0004-4000-8000-000000000004',
      name: 'Jadavpur Vidyapith',
      latitude: 22.499, longitude: 88.3695,
      capacity: 300, occupancy: 92, status: 'open', elevation_metres: 8.2,
      facilities: ['Drinking water', 'Toilets', 'Cooked meals'],
    },
  ];

  const roster = SEED.map((s) => {
    const metres = distanceMetres(POSITION, s);
    return {
      ...s,
      address: '',
      distanceMetres: metres,
      walkMinutes: walkMinutes(metres),
      routeCrossesRisk: false,
    };
  }).sort((a, b) => a.distanceMetres - b.distanceMetres);

  const byName = (n) => roster.find((s) => s.name.startsWith(n));
  const deshapriya = byName('Deshapriya');
  const netaji = byName('Netaji');
  const jadavpur = byName('Jadavpur');

  // The fixture only means something if the geography is what the seed intended:
  // two halls on foot from Ward 58, Netaji far outside the walkable limit.
  assert.ok(deshapriya.distanceMetres < 600, 'Deshapriya should be a few minutes away');
  assert.ok(jadavpur.distanceMetres < WALKABLE_LIMIT_M, 'Jadavpur should be walkable');
  assert.ok(netaji.distanceMetres > WALKABLE_LIMIT_M, 'Netaji should be out of range');

  // -------------------------------------------------------------------------
  // needsOf
  // -------------------------------------------------------------------------
  const blank = {
    language: 'en', contact_name: null, ward: null, address: null,
    people: 1, tenure: null,
    elderly: 0, infants: 0, pregnant: 0, needs_assistance: 0, non_swimmers: 0,
    livestock: null,
  };

  assert.deepStrictEqual(
    needsOf(null),
    { people: 1, wantsMedical: false, avoidsWater: false },
    'no profile must behave exactly as the app did before it asked',
  );
  assert.strictEqual(needsOf({ ...blank, people: 7 }).people, 7);
  assert.strictEqual(needsOf({ ...blank, people: 0 }).people, 1, 'people floors at 1');
  assert.strictEqual(needsOf({ ...blank, infants: 1 }).wantsMedical, true);
  assert.strictEqual(needsOf({ ...blank, elderly: 2 }).wantsMedical, true);
  assert.strictEqual(needsOf({ ...blank, needs_assistance: 1 }).wantsMedical, true);
  assert.strictEqual(needsOf({ ...blank, pregnant: 1 }).wantsMedical, true);
  assert.strictEqual(needsOf({ ...blank, non_swimmers: 3 }).wantsMedical, false,
    'not being able to swim is not a medical need');
  assert.strictEqual(needsOf({ ...blank, non_swimmers: 3 }).avoidsWater, true);

  assert.strictEqual(hasMedical(deshapriya), true);
  assert.strictEqual(hasMedical(jadavpur), false);
  // Phrasing a district office might actually type.
  assert.strictEqual(hasMedical({ ...jadavpur, facilities: ['Medical post'] }), true);
  assert.strictEqual(hasMedical({ ...jadavpur, facilities: ['First aid tent'] }), true);
  assert.strictEqual(hasMedical({ ...jadavpur, facilities: ['Nursing station'] }), true);

  // -------------------------------------------------------------------------
  // chooseShelter
  // -------------------------------------------------------------------------
  const flood = 'flood';

  // A lone adult: nearest walkable hall with room. Deshapriya at ~350 m.
  const alone = chooseShelter(roster, needsOf(null), flood);
  assert.strictEqual(alone.shelter.name, deshapriya.name);
  assert.deepStrictEqual(
    { fitsAll: alone.fitsAll, walkable: alone.walkable, medical: alone.medical },
    { fitsAll: true, walkable: true, medical: false },
    'medical is only true when the household asked for it',
  );

  // A full hall is never recommended, however close or high it is.
  assert.ok(
    chooseShelter(roster, needsOf(null), flood).shelter.status === 'open',
    'a full shelter must never be recommended',
  );

  // THE BUG THIS PHASE EXISTS TO FIX. Deshapriya has 214 free, so seven people
  // still fit — squeeze it to four and the recommendation must move rather than
  // sending a family of seven somewhere that can take four of them.
  const tight = roster.map((s) =>
    s.id === deshapriya.id ? { ...s, occupancy: s.capacity - 4 } : s,
  );
  const seven = chooseShelter(tight, needsOf({ ...blank, people: 7 }), flood);
  assert.notStrictEqual(seven.shelter.name, deshapriya.name,
    'a hall with four places left is not a shelter for seven people');
  assert.strictEqual(seven.shelter.name, jadavpur.name,
    'the other walkable hall with room should win');
  assert.strictEqual(seven.fitsAll, true);
  assert.strictEqual(seven.walkable, true);

  // One person still goes to the near hall with four places left.
  assert.strictEqual(
    chooseShelter(tight, needsOf(null), flood).shelter.name,
    deshapriya.name,
    'four places is plenty for one person',
  );

  // Room beats a short walk. Squeeze both walkable halls and the choice has to
  // walk to Netaji rather than turn a household away at a door 350 m from home.
  const squeezed = roster.map((s) =>
    s.status === 'open' && s.distanceMetres <= WALKABLE_LIMIT_M
      ? { ...s, occupancy: s.capacity - 2 }
      : s,
  );
  const far = chooseShelter(squeezed, needsOf({ ...blank, people: 7 }), flood);
  assert.strictEqual(far.shelter.name, netaji.name, 'a longer walk beats splitting up');
  assert.strictEqual(far.fitsAll, true);
  assert.strictEqual(far.walkable, false, 'and it must admit the walk is long');

  // Nothing has room for forty-two. Closest wins, and it says it does not fit.
  const crowd = chooseShelter(roster, needsOf({ ...blank, people: 4200 }), flood);
  assert.strictEqual(crowd.shelter.name, deshapriya.name);
  assert.strictEqual(crowd.fitsAll, false, 'it must not claim room it does not have');
  assert.strictEqual(crowd.placesFree, 214);

  // Medical care outranks a shorter walk within the qualifying pool: an infant
  // sends the same household to the hall with a medical desk.
  const withInfant = chooseShelter(
    roster,
    needsOf({ ...blank, people: 3, infants: 1 }),
    flood,
  );
  assert.strictEqual(withInfant.shelter.name, deshapriya.name);
  assert.strictEqual(withInfant.medical, true);

  // Take the medical desk away from the near hall and the choice walks further
  // for one, rather than ignoring what the household said it needs.
  const noDesk = roster.map((s) =>
    s.id === deshapriya.id
      ? { ...s, facilities: ['Drinking water', 'Toilets'] }
      : s.id === jadavpur.id
        ? { ...s, facilities: ['Drinking water', 'Medical desk'] }
        : s,
  );
  assert.strictEqual(
    chooseShelter(noDesk, needsOf({ ...blank, people: 3, infants: 1 }), flood).shelter.name,
    jadavpur.name,
    'an infant is worth the extra 1.8 km to a hall with a medical desk',
  );
  // …but only when somebody needs it. The same roster, no infant, stays near.
  assert.strictEqual(
    chooseShelter(noDesk, needsOf(null), flood).shelter.name,
    deshapriya.name,
  );

  // Higher ground only decides a flood, and only when the rise pays for the walk.
  // Jadavpur is 0.7 m higher than Deshapriya and 1.5 km further, which does not.
  assert.strictEqual(
    chooseShelter(roster, needsOf(null), 'flood').shelter.name,
    deshapriya.name,
    '70 cm of datum is not worth 1.5 km of flooded street',
  );
  const highJadavpur = roster.map((s) =>
    s.id === jadavpur.id ? { ...s, elevation_metres: 20 } : s,
  );
  assert.strictEqual(
    chooseShelter(highJadavpur, needsOf(null), 'flood').shelter.name,
    jadavpur.name,
    'in a flood, 12 m of extra ground is worth the walk',
  );
  assert.strictEqual(
    chooseShelter(highJadavpur, needsOf(null), 'fire').shelter.name,
    deshapriya.name,
    'in a fire, elevation must not decide anything',
  );

  // Every hall closed is a real night, and it must return null rather than
  // recommending a closed building.
  assert.strictEqual(
    chooseShelter(roster.map((s) => ({ ...s, status: 'closed' })), needsOf(null), flood),
    null,
  );
  assert.strictEqual(chooseShelter([], needsOf(null), flood), null);

  // Same input, same answer, every time — the map's marks must not flicker.
  const once = chooseShelter(roster, needsOf(null), flood).shelter.id;
  for (let i = 0; i < 20; i++) {
    assert.strictEqual(
      chooseShelter([...roster].reverse(), needsOf(null), flood).shelter.id,
      once,
      'the recommendation must not depend on roster order',
    );
  }

  // A ladder of halls each a little higher than the last, all the same distance.
  // This is the shape that broke the first version of `better`: an elevation
  // comparison with a "close enough to ignore" band is not transitive, so the
  // winner depended on which end of the array the fold started from. Every
  // permutation must agree, and it must be the highest one.
  const ladder = [7.0, 7.4, 7.9, 8.3, 8.7].map((elevation_metres, i) => ({
    ...deshapriya,
    id: `ladder-${i}`,
    name: `Ladder ${i}`,
    elevation_metres,
  }));
  for (let i = 0; i < ladder.length; i++) {
    const rotated = [...ladder.slice(i), ...ladder.slice(0, i)];
    assert.strictEqual(
      chooseShelter(rotated, needsOf(null), flood).shelter.name,
      'Ladder 4',
      'a rotated roster must not change which hall is highest',
    );
    assert.strictEqual(
      chooseShelter([...rotated].reverse(), needsOf(null), flood).shelter.name,
      'Ladder 4',
    );
  }

  // -------------------------------------------------------------------------
  // The copy that reports the compromise
  // -------------------------------------------------------------------------
  assert.match(shelterReason(deshapriya, flood, true, 1), /higher ground/);
  assert.match(
    shelterReason({ ...deshapriya, occupancy: deshapriya.capacity - 4 }, flood, true, 7),
    /not enough for all 7/,
    'a hall short of places must say so ahead of anything reassuring',
  );
  assert.strictEqual(
    shelterReason({ ...deshapriya, status: 'full' }, flood, true, 7),
    'At capacity. Do not go here.',
  );
  assert.strictEqual(shelterCaveat(alone, needsOf(null)), null,
    'no compromise means no caveat');
  assert.match(shelterCaveat(crowd, needsOf({ ...blank, people: 4200 })), /best of them/);
  assert.match(shelterCaveat(far, needsOf({ ...blank, people: 7 })), /long walk/);
  assert.match(
    shelterCaveat(
      { ...alone, medical: false },
      needsOf({ ...blank, infants: 1 }),
    ),
    /No medical desk/,
  );

  // -------------------------------------------------------------------------
  // sensorTrend
  // -------------------------------------------------------------------------
  const NOW = Date.parse('2026-09-05T18:00:00.000Z');
  /** Newest-first readings, `mins` apart, from raw ADC counts oldest-first. */
  const series = (counts, mins = 10) =>
    counts
      .map((water_level, i) => ({
        id: `r${i}`,
        node_id: 'n1',
        temperature: null, humidity: null, flame_detected: null,
        smoke_level: null, water_level, rain_level: null,
        created_at: new Date(NOW - (counts.length - 1 - i) * mins * 60_000).toISOString(),
      }))
      .reverse();

  assert.strictEqual(sensorTrend([], 'water_level', NOW), null);
  assert.strictEqual(sensorTrend(series([1000, 1200]), 'water_level', NOW), null,
    'two samples is not a trend');
  assert.strictEqual(sensorTrend(series([1000, 1200, 1400], 1), 'water_level', NOW), null,
    'three samples two minutes apart would imply an absurd rate');

  const rising = sensorTrend(series([1600, 2000, 2400, 2800, 3100]), 'water_level', NOW);
  assert.strictEqual(rising.direction, 'rising');
  assert.strictEqual(rising.spanMinutes, 40);
  assert.strictEqual(rising.latest, 76);           // 3100/4095
  assert.strictEqual(rising.series[0], 39);        // 1600/4095
  assert.strictEqual(rising.changePoints, 37);
  assert.strictEqual(rising.pointsPerHour, 56);    // 37 points over 40 min

  const falling = sensorTrend(series([3100, 2800, 2400, 2000, 1600]), 'water_level', NOW);
  assert.strictEqual(falling.direction, 'falling');
  assert.strictEqual(falling.changePoints, -37);

  // A wobble inside the noise band is not a trend, and must not read as one.
  const flat = sensorTrend(series([2000, 2010, 1990, 2020, 2005]), 'water_level', NOW);
  assert.strictEqual(flat.direction, 'steady');
  assert.ok(Math.abs(flat.changePoints) < 2);

  // Nulls are skipped, not treated as zero — a null reading is a sensor a node
  // does not carry, and reading it as 0% would invent a collapse in the water.
  const withNulls = series([1600, 2000, 2400, 2800, 3100]).map((r, i) =>
    i === 1 ? { ...r, water_level: null } : r,
  );
  const skipped = sensorTrend(withNulls, 'water_level', NOW);
  assert.strictEqual(skipped.direction, 'rising');
  assert.strictEqual(skipped.series.length, 4);

  // Anything older than the window is dropped, so last night cannot flatten now.
  // These five are 40 minutes apart, so the two oldest — a sensor that was nearly
  // full three hours ago — fall outside the 90-minute window. Counting them would
  // report falling water to somebody whose water is coming up.
  const recent = sensorTrend(series([3900, 3800, 300, 400, 500], 40), 'water_level', NOW);
  assert.strictEqual(recent.spanMinutes, 80, 'only the samples inside the window count');
  assert.strictEqual(recent.series.length, 3);
  assert.strictEqual(recent.direction, 'rising');

  // A node whose clock is ahead of the phone must not invert the slope.
  const future = series([1600, 2000, 2400, 2800, 3100]).map((r, i) =>
    i === 0 ? { ...r, created_at: new Date(NOW + 600_000).toISOString() } : r,
  );
  assert.strictEqual(sensorTrend(future, 'water_level', NOW).direction, 'rising');

  // Thinning keeps the ends and the count, so the line still starts and finishes
  // where the data does.
  const long = Array.from({ length: 120 }, (_, i) => i);
  assert.strictEqual(thin(long, 24).length, 24);
  assert.strictEqual(thin(long, 24)[0], 0);
  assert.strictEqual(thin(long, 24)[23], 119);
  assert.deepStrictEqual(thin([1, 2, 3], 24), [1, 2, 3]);

  assert.match(trendSentence(rising, 'water_level'), /Still rising/);
  assert.match(trendSentence(rising, 'water_level'), /39% to 76%/);
  assert.match(trendSentence(rising, 'water_level'), /40 minutes/);
  assert.match(trendSentence(flat, 'water_level'), /Holding steady/);
  assert.match(trendSentence(falling, 'water_level'), /Falling back/);
  assert.ok(trendRate(rising), 'a 56-point-an-hour rise is worth stating');
  assert.strictEqual(trendRate(falling), null, 'no rate for water going down');
  assert.strictEqual(trendRate(flat), null);

  // -------------------------------------------------------------------------
  // hazardTrend — which sensor the detail screen draws
  // -------------------------------------------------------------------------
  const wet = series([1600, 2000, 2400, 2800, 3100]);
  assert.strictEqual(hazardTrend(wet, 'flood', NOW).field, 'water_level');
  assert.strictEqual(hazardTrend(wet, 'fire', NOW), null,
    'a flood node has no smoke history, and must not be made to invent one');

  // The case a plain lookup gets wrong: a rain gauge with no float switch raises
  // flood alerts and has nothing in water_level at all. It must fall through to
  // the column that does have history rather than draw a blank panel.
  const gauge = wet.map((r) => ({ ...r, water_level: null, rain_level: 3000 }));
  const gaugeTrend = hazardTrend(gauge, 'flood', NOW);
  assert.strictEqual(gaugeTrend.field, 'rain_level',
    'no water column means the rain column, not nothing');
  assert.strictEqual(gaugeTrend.trend.direction, 'steady',
    'and a gauge that has not moved must say so rather than claim a rise');
  const risingRain = series([1200, 1600, 2100, 2600, 3000]).map((r) => ({
    ...r, water_level: null, rain_level: r.water_level,
  }));
  assert.strictEqual(hazardTrend(risingRain, 'flood', NOW).field, 'rain_level');

  const smoky = series([900, 1400, 1900, 2500, 3000]).map((r) => ({
    ...r, water_level: null, smoke_level: r.water_level,
  }));
  assert.strictEqual(hazardTrend(smoky, 'fire', NOW).field, 'smoke_level');
  assert.strictEqual(hazardTrend(smoky, 'fire', NOW).trend.direction, 'rising');

  // Water outranks rain when both have history: the alert is about the water.
  const both = series([1600, 2000, 2400, 2800, 3100]).map((r) => ({
    ...r, rain_level: 4000 - r.water_level,
  }));
  assert.strictEqual(hazardTrend(both, 'flood', NOW).field, 'water_level');
  assert.strictEqual(hazardTrend([], 'flood', NOW), null);

  // -------------------------------------------------------------------------
  // emergencySmsBody
  //
  // The one string in this app a stranger has to act on without being able to
  // ask a follow-up question, so it is asserted on content rather than shape.
  // -------------------------------------------------------------------------
  const POS = {
    latitude: 22.5148,
    longitude: 88.361,
    accuracyMetres: 18,
    locality: 'Ward 58, Kolkata',
  };
  const ZONE = {
    id: 'z1',
    name: 'Tollygunge Canal Bank',
    hazard_type: 'flood',
    severity: 'critical',
    polygon: [],
    description: null,
  };

  const bare = emergencySmsBody(POS, null, null);
  assert.match(bare, /^HELP NEEDED/, 'the first line must read as an emergency');
  assert.match(bare, /22\.5148,88\.3610/, 'coordinates, four places');
  assert.match(bare, /approx 18 m/, 'and how much to trust them');
  assert.match(bare, /Household size not recorded/,
    'no profile must say so rather than let a coordinator assume one adult');

  const family = emergencySmsBody(
    POS,
    { ...blank, people: 6, ward: '58', elderly: 1, infants: 2, non_swimmers: 3,
      address: '14B Netaji Lane', contact_name: 'A. Das', livestock: '2 goats' },
    ZONE,
  );
  assert.match(family, /ward 58/);
  assert.match(family, /6 people/);
  assert.match(family, /1 elderly/);
  assert.match(family, /2 infants/, 'plural when there is more than one');
  assert.match(family, /3 cannot swim/);
  assert.ok(!/0 pregnant/.test(family), 'zero counts must not be listed');
  assert.match(family, /14B Netaji Lane/);
  assert.match(family, /Contact: A\. Das/);
  assert.match(family, /critical flood/);

  assert.match(
    emergencySmsBody(POS, { ...blank, people: 1, infants: 1 }, null),
    /1 person\n.*1 infant/s,
    'singular for one of each',
  );

  // Ward comes from the profile, so with no ward the locality must stand alone
  // rather than trailing an empty "ward".
  assert.ok(!/ward/.test(emergencySmsBody(POS, blank, null)));

  // A long profile is cut on a line boundary, so the message never ends in a
  // half-written number that reads as a real one.
  const wordy = emergencySmsBody(
    POS,
    { ...blank, people: 9, ward: '58', elderly: 2, infants: 2, pregnant: 1,
      needs_assistance: 2, non_swimmers: 4,
      address: 'X'.repeat(200), contact_name: 'Y'.repeat(80),
      livestock: 'Z'.repeat(80) },
    ZONE,
  );
  assert.ok(wordy.length <= MAX_SMS_CHARS, 'two segments is the budget');
  assert.ok(!wordy.endsWith('\n'));
  assert.match(wordy, /22\.5148,88\.3610/,
    'whatever is dropped, the coordinates survive');
  assert.match(wordy, /9 people/, 'and so does the head count');

  // -------------------------------------------------------------------------
  // Flood-aware routing: everything about it that can be checked without a key
  // -------------------------------------------------------------------------
  // This is the one feature in the app whose network path has never returned a
  // 200 in this environment, which is exactly why the pure half is separated out
  // and asserted here. A silent bug in `avoidPolygons` would send somebody
  // through the water on a route that looked computed and confident.
  const RING = [
    [88.35, 22.51],
    [88.37, 22.51],
    [88.37, 22.53],
    [88.35, 22.53],
  ];
  const FLOOD = { id: 'z1', name: 'Tollygunge Canal Bank', hazard_type: 'flood',
                  severity: 'critical', polygon: RING, description: null };

  const avoided = avoidPolygons([FLOOD]);
  const ring = avoided.options.avoid_polygons.coordinates[0][0];
  assert.strictEqual(avoided.options.avoid_polygons.type, 'MultiPolygon');
  assert.strictEqual(ring.length, RING.length + 1,
    'GeoJSON wants the closing point back that data/queries.ts dropped');
  assert.deepStrictEqual(ring[ring.length - 1], ring[0], 'and it has to be the first');
  assert.deepStrictEqual(ring[0], [88.35, 22.51],
    'lng first, all the way through — PostGIS order is ORS order');

  // A degenerate ring is dropped rather than sent: ORS rejects the whole request
  // on one bad polygon, which would lose the route over a zone that could not
  // have changed it.
  const twoPoint = { ...FLOOD, id: 'z2', polygon: [[88.36, 22.51], [88.37, 22.52]] };
  assert.strictEqual(
    avoidPolygons([twoPoint, FLOOD]).options.avoid_polygons.coordinates.length,
    1,
    'one usable zone of two',
  );
  assert.deepStrictEqual(avoidPolygons([twoPoint]), {},
    'nothing left to avoid means no options key at all, not an empty polygon');
  assert.deepStrictEqual(avoidPolygons([]), {}, 'a dry day is the ordinary case');

  const body = directionsBody(
    { latitude: 22.5148, longitude: 88.361 },
    { latitude: 22.5175, longitude: 88.3585 },
    [FLOOD],
  );
  assert.deepStrictEqual(body.coordinates, [[88.361, 22.5148], [88.3585, 22.5175]],
    'start then destination, lng first');
  assert.strictEqual(body.instructions, true, 'no instructions, no turn-by-turn');
  assert.ok(body.options, 'the zones must reach the request or this is a plain router');

  // ORS GeoJSON in, the same RouteStep[] the surveyed table produces out.
  const ORS = {
    features: [
      {
        geometry: { coordinates: [[88.361, 22.5148], [88.3600, 22.5160], [88.3585, 22.5175]] },
        properties: {
          segments: [
            {
              steps: [
                { instruction: 'Head north on Rashbehari Avenue', distance: 120.4, type: 11 },
                { instruction: 'Turn left onto Deshapriya Park Road', distance: 60.6, type: 0 },
                { instruction: 'Turn right', distance: 40, type: 1 },
                { instruction: 'Arrive at your destination', distance: 0, type: 10 },
              ],
            },
          ],
        },
      },
    ],
  };
  const parsed = parseOrsRoute(ORS);
  assert.ok(parsed.ok);
  assert.deepStrictEqual(
    parsed.steps.map((s) => s.manoeuvre),
    ['start', 'left', 'right', 'arrive'],
    'fourteen ORS codes collapse to the five arrows this app draws',
  );
  assert.strictEqual(parsed.steps[0].distance_metres, 120,
    'metres are whole — a turn in 120.4 m is false precision on foot');
  assert.deepStrictEqual(parsed.path[0], { latitude: 22.5148, longitude: 88.361 },
    'transposed back to lat/lng exactly once, for the map');
  assert.strictEqual(parsed.path.length, 3);

  // An unknown code becomes `straight`, never a guessed turn: an arrow reading
  // carry-on beside text reading turn-left sends nobody into a canal.
  const odd = parseOrsRoute({
    features: [{ properties: { segments: [{ steps: [
      { instruction: 'Keep going', distance: 10, type: 6 },
      { instruction: 'Enter the roundabout', distance: 10 },
    ] }] } }],
  });
  assert.deepStrictEqual(odd.steps.map((s) => s.manoeuvre), ['straight', 'straight']);
  assert.deepStrictEqual(odd.path, [], 'no geometry is an empty path, not a crash');

  // Every unusable answer resolves to a reason. Nothing here may throw: the
  // screen behind this has a working compass bearing to fall back to, and an
  // exception would replace it with a blank.
  for (const junk of [null, undefined, {}, { features: [] }, { features: [{}] },
                      'not json', { features: [{ properties: { segments: [] } }] }]) {
    assert.strictEqual(parseOrsRoute(junk).ok, false, `${JSON.stringify(junk)} is no-path`);
    assert.strictEqual(parseOrsRoute(junk).reason, 'no-path');
  }
  // A step with no instruction is not a step. If they are all like that, there is
  // nothing to read out and the bearing is the better answer.
  assert.strictEqual(
    parseOrsRoute({ features: [{ properties: { segments: [{ steps: [
      { distance: 10, type: 1 }, { instruction: '', distance: 5 },
    ] }] } }] }).reason,
    'no-path',
  );

  // The two failures a citizen must be able to tell apart: no dry way out, and
  // the service being down. Anything unrecognised errs towards 'unreachable',
  // which invites a retry — a wrong 'no-path' tells somebody there is no way out.
  assert.strictEqual(orsFailure({ error: { code: 2009 } }), 'no-path');
  assert.strictEqual(orsFailure({ error: { code: 2010 } }), 'no-path');
  assert.strictEqual(orsFailure({ error: { code: 2004 } }), 'unreachable');
  assert.strictEqual(orsFailure(null), 'unreachable');
  assert.strictEqual(orsFailure('<html>502 Bad Gateway</html>'), 'unreachable');

  // The provenance line, which is the reader's only signal that a machine wrote
  // these turns rather than a person who walked them.
  assert.match(routeSource('surveyed'), /ward office/);
  assert.match(routeSource('generated'), /street map/);
  assert.match(routeSource('generated'), /Nobody has walked it/,
    'a generated route must say so, in the sentence next to it');
  assert.ok(!/ward office/.test(routeSource('generated')),
    'and must never borrow the authority of one that was surveyed');

  // -------------------------------------------------------------------------
  // The dictionaries
  // -------------------------------------------------------------------------
  // Four things can go wrong with a gettext-style dictionary, and none of them
  // throws at runtime — every one of them silently renders English to a reader
  // who does not read English. So they are checked here instead.
  const { DICTIONARY, fill, hasIndicScript, t } = await import(
    '../src/domain/i18n.ts'
  );

  const bn = Object.keys(DICTIONARY.bn);
  const hi = Object.keys(DICTIONARY.hi);

  // 1. English is the key and the answer, so it needs no dictionary and cannot be
  //    broken by an edit to one.
  assert.strictEqual(t('en', 'Leave now'), 'Leave now');
  assert.strictEqual(t('bn', 'Leave now'), 'এখনই বেরোন');
  assert.strictEqual(t('bn', 'A sentence nobody has translated yet'),
    'A sentence nobody has translated yet',
    'a missing key must fall back to the English, not to empty');

  // 2. The two languages must hold the same key set. A key in one and not the
  //    other is a screen that is Bengali for one reader and English for another,
  //    which is the failure nobody notices because nobody reads both.
  for (const key of bn) {
    assert.ok(key in DICTIONARY.hi, `bn has '${key}' and hi does not`);
  }
  for (const key of hi) {
    assert.ok(key in DICTIONARY.bn, `hi has '${key}' and bn does not`);
  }

  // 3. Placeholders must survive translation exactly. A dropped {place} is a
  //    sentence with no location in it; a misspelled one renders as literal
  //    '{plcae}' on the screen, because fill leaves what it cannot resolve.
  const holes = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const [lang, dict] of Object.entries(DICTIONARY)) {
    for (const [key, value] of Object.entries(dict)) {
      assert.strictEqual(holes(value), holes(key),
        `${lang} '${key}' does not carry the same placeholders`);
      assert.notStrictEqual(value, key,
        `${lang} '${key}' is not translated, it is copied`);
      assert.ok(hasIndicScript(value),
        `${lang} '${key}' has no Indic letters in it at all`);
    }
  }

  // 4. No orphans. Editing an English sentence in a screen silently orphans its
  //    translation — the app then renders the new English to a Bengali reader and
  //    nothing anywhere complains. This is the assertion that catches a typo fix.
  const { readdirSync, readFileSync } = require('fs');
  const SRC = new URL('../src/', pathToFileURL(__filename));
  const source = readdirSync(SRC, { recursive: true })
    .filter((f) => /\.tsx?$/.test(f) && !f.endsWith('domain/i18n.ts'))
    .map((f) => readFileSync(new URL(f, SRC), 'utf8'))
    .join('\n');
  for (const key of bn) {
    assert.ok(source.includes(key),
      `'${key}' is in the dictionaries but no longer in any screen`);
  }

  // 5. An unresolved placeholder is left standing on purpose: a visible {place}
  //    is a bug report, and a sentence with a hole in it is one somebody acts on.
  assert.strictEqual(fill('{a} and {b}', { a: 'this' }), 'this and {b}');
  assert.strictEqual(fill('{n} m', { n: 400 }), '400 m');

  // 6. Script detection drives the font swap in theme/type.ts, so it has to be
  //    right about a Latin landmark name sitting in a Bengali screen.
  assert.ok(hasIndicScript('এখনই বেরোন'));
  assert.ok(hasIndicScript('ऊँची जगह'));
  assert.ok(!hasIndicScript('Rabindra Sarobar'));
  assert.ok(!hasIndicScript('3100 of 4095'));
  assert.ok(hasIndicScript('112-এ ফোন করুন'), 'mixed Latin and Bengali is Bengali');

  console.log(`All domain checks passed. ${bn.length} strings in each language.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
