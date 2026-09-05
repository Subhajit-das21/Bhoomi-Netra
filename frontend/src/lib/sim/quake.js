/**
 * Ground motion from an earthquake.
 *
 * Peak ground acceleration comes from the Joyner & Boore (1981) attenuation
 * relation with the focal depth as the pseudo-depth term, amplified for soft
 * ground via Vs30. PGA converts to Modified Mercalli intensity with Wald et al.
 * (1999). The wavefront sweeps outward at the shear-wave velocity, so the
 * timeline is in *seconds* — the shaking really is over that fast, and the
 * useful thing to watch is which structures fail during the strong-motion
 * window rather than an expanding blob.
 */

const P_VELOCITY_KM_S = 6.0;
const S_VELOCITY_KM_S = 3.5;

/** Joyner & Boore 1981, PGA in g. */
export function pgaJoynerBoore(mw, epiKm, depthKm) {
  const r = Math.sqrt(epiKm * epiKm + depthKm * depthKm);
  const log10 = -1.02 + 0.249 * mw - Math.log10(Math.max(1, r)) - 0.00255 * r;
  return Math.pow(10, log10);
}

/** Wald et al. 1999 PGA→MMI, PGA in g. */
export function pgaToMmi(pgaG) {
  const cms2 = Math.max(0.1, pgaG * 980.665);
  const high = 3.66 * Math.log10(cms2) - 1.66;
  const low = 2.2 * Math.log10(cms2) + 1.0;
  const mmi = high >= 5 ? high : low;
  return Math.max(1, Math.min(12, mmi));
}

export const MMI_LABELS = {
  1: 'Not felt', 2: 'Weak', 3: 'Weak', 4: 'Light', 5: 'Moderate', 6: 'Strong',
  7: 'Very strong', 8: 'Severe', 9: 'Violent', 10: 'Extreme', 11: 'Extreme', 12: 'Extreme',
};

/** Strong-motion duration at a site — longer for bigger events and softer soil. */
function strongMotionSec(mw, rKm, vs30) {
  return Math.max(2, 1.5 + 1.2 * Math.pow(Math.max(0, mw - 4.5), 1.6) + 0.12 * rKm + (400 - Math.min(400, vs30)) / 60);
}

export function simulateQuake(grid, terrain, params) {
  const { size, cellSizeM, cellAreaM2 } = grid;
  const n = size * size;
  const steps = params.steps ?? 32;
  const mw = params.magnitude ?? 6.3;
  const depthKm = params.depthKm ?? 12;
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);

  // Window: the S front crossing the domain, plus the strong-motion tail at the
  // far edge. Clamped so a 2 km domain still gives a readable timeline.
  const edgeKm = (grid.radiusKm * Math.SQRT2);
  const totalSec = Math.max(
    14,
    Math.min(120, edgeKm / S_VELOCITY_KM_S + strongMotionSec(mw, edgeKm, 250) + 4)
  );
  const dtSec = totalSec / steps;

  const mmi = new Float32Array(n);
  const pga = new Float32Array(n);
  const arrivalSec = new Float32Array(n);
  const durationSec = new Float32Array(n);
  let maxMmi = 0;
  let maxPga = 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const epiKm = (Math.hypot(x - cx, y - cy) * cellSizeM) / 1000;
      const amp = Math.min(2.2, Math.pow(760 / Math.max(120, terrain.vs30[i]), 0.35));
      const g = pgaJoynerBoore(mw, epiKm, depthKm) * amp;
      pga[i] = g;
      mmi[i] = pgaToMmi(g);
      arrivalSec[i] = Math.sqrt(epiKm * epiKm + depthKm * depthKm) / S_VELOCITY_KM_S;
      durationSec[i] = strongMotionSec(mw, epiKm, terrain.vs30[i]);
      if (mmi[i] > maxMmi) maxMmi = mmi[i];
      if (g > maxPga) maxPga = g;
    }
  }

  // Radii worth quoting: what was felt, what shook hard enough to damage.
  const radiusForMmi = (target) => {
    for (let d = 0; d < size / 2; d++) {
      const i = cy * size + Math.min(size - 1, cx + d);
      if (mmi[i] < target) return (d * cellSizeM) / 1000;
    }
    return grid.radiusKm;
  };

  const frames = [];
  const eventLog = [];
  const energyJ = Math.pow(10, 1.5 * mw + 4.8);

  for (let t = 0; t <= steps; t++) {
    const nowSec = t * dtSec;
    const pRadiusKm = Math.max(0, P_VELOCITY_KM_S * nowSec);
    const sRadiusKm = Math.max(0, S_VELOCITY_KM_S * nowSec);
    const norm = new Float32Array(n);
    const envelope = new Float32Array(n);
    const active = [];
    let shakenCells = 0;
    let popFelt = 0;
    let popStrong = 0;
    let energySum = 0;

    for (let i = 0; i < n; i++) {
      const since = nowSec - arrivalSec[i];
      if (since < 0) continue;
      shakenCells++;
      // Shaking envelope: fast rise on arrival, exponential decay through the
      // strong-motion window.
      const dur = durationSec[i];
      const env = since < 0.6 ? since / 0.6 : Math.exp(-(since - 0.6) / (dur * 0.55));
      envelope[i] = Math.max(0, Math.min(1, env));
      const scaled = mmi[i] / 12;
      norm[i] = Math.min(1, scaled * (0.45 + 0.55 * envelope[i]));
      energySum += pga[i] * envelope[i];
      const popHere = terrain.popDensity[i] * (cellAreaM2 / 1e6);
      if (mmi[i] >= 4) popFelt += popHere;
      if (mmi[i] >= 6) popStrong += popHere;
      if (mmi[i] >= 5) active.push(i);
    }

    if (t === 0) eventLog.push({ t, kind: 'origin', text: `M${mw.toFixed(1)} rupture at ${depthKm} km depth` });
    if (frames.length && sRadiusKm >= edgeKm && !eventLog.some((e) => e.kind === 'swept')) {
      eventLog.push({ t, kind: 'swept', text: `S wave has crossed the whole ${grid.radiusKm} km study area` });
    }

    frames.push({
      t,
      seconds: nowSec,
      norm,
      envelope,
      mmi,
      pga,
      active,
      pRadiusKm,
      sRadiusKm,
      metrics: {
        maxMmi,
        maxPgaG: maxPga,
        shakenAreaKm2: (shakenCells * cellAreaM2) / 1e6,
        pWaveRadiusKm: pRadiusKm,
        sWaveRadiusKm: sRadiusKm,
        populationFelt: Math.round(popFelt),
        populationStrongShaking: Math.round(popStrong),
        meanShakingNow: shakenCells ? energySum / shakenCells : 0,
      },
    });
  }

  const last = frames[frames.length - 1];
  return {
    frames,
    eventLog,
    timeUnit: 's',
    dtSec,
    fields: { mmi, pga, arrivalSec, durationSec },
    scale: { field: 1, column: 12 },
    summary: {
      headline: `M${mw.toFixed(1)} — MMI ${Math.round(maxMmi)} (${MMI_LABELS[Math.round(maxMmi)]}) at the epicentre`,
      finalMetrics: last.metrics,
      seismology: {
        energyJ,
        energyTonsTnt: energyJ / 4.184e9,
        feltRadiusKm: radiusForMmi(4),
        damageRadiusKm: radiusForMmi(7),
        // Båth's law and a 24 h Omori estimate, both rules of thumb.
        expectedLargestAftershock: Math.max(2, mw - 1.2),
        expectedAftershocks24h: Math.max(1, Math.round(Math.pow(10, mw - 4.0))),
      },
      assumptions: [
        `M${mw.toFixed(1)} at ${depthKm} km depth`,
        'PGA from Joyner & Boore (1981), MMI from Wald et al. (1999)',
        'Vs30 inferred from terrain, not measured',
      ],
    },
  };
}
