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
  const { shelterReason, shelterCaveat, trendSentence, trendRate } = await import(
    '../src/domain/copy.ts'
  );
  const { sensorTrend, thin } = await import('../src/domain/trend.ts');
  const { distanceMetres, walkMinutes } = await import('../src/domain/geo.ts');

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

  console.log('All domain checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
