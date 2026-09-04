import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EMPTY_PROFILE,
  markHouseholdSafe,
  restoreHousehold,
  saveHousehold,
  type RestoredHousehold,
} from '../data/household';
import { deviceIdentity } from '../services/identity';
import { StoreKey, forget, readJson, readText, writeJson, writeText } from '../services/store';
import type { HouseholdProfile, StoredHousehold } from '../domain/types';

/**
 * Who is in the house, and whether we have asked yet.
 *
 * Deliberately a separate provider from CitizenProvider, wrapped outside it in
 * App.tsx. Two reasons, and the second is the load-bearing one:
 *
 *   The two have different lifetimes. Everything in CitizenProvider is fetched,
 *   replaced wholesale and thrown away when the app closes. This is written once
 *   and kept for two years.
 *
 *   Phase 3 needs the household inside CitizenProvider — `recommendedShelter`
 *   cannot check `capacity - occupancy >= people` without knowing `people`.
 *   Nesting this above it means that becomes one `useHousehold()` call rather than
 *   a refactor.
 *
 * ------------------------------------------------------------------
 * The device is authoritative; Supabase is a backup
 * ------------------------------------------------------------------
 * Every save writes AsyncStorage first and only then tries the network. That order
 * is not an optimisation. Somebody filling this in has just been told water is
 * rising; if the write to Supabase fails they must not lose five steps of typing,
 * and they must not be shown a retry dialog either. `synced: false` records the
 * gap and Settings is where it gets retried.
 *
 * The consequence to be honest about: an unsynced profile is invisible to the
 * district. It still improves shelter choice and it still fills an SMS, because
 * both of those happen on this phone — but no control room can see it.
 *
 * `markSafe` is the one exception and inverts the order for a reason given at the
 * call site: a roll-call that only reached this phone would be a lie about who is
 * still being looked for.
 */

/** What the app shell should be showing. */
export type HouseholdGate =
  /** Reading the store, and briefly waiting on the reinstall probe. */
  | 'loading'
  /** No profile on this device. Run the questions. */
  | 'ask'
  /** There is a profile, or the user has declined to give one. Run the app. */
  | 'done';

/**
 * How long the first launch waits for `restore_household` before showing the
 * questions.
 *
 * The request itself is allowed eight seconds — see supabase.ts, which sets that
 * budget for a congested 2G cell. Waiting eight seconds behind a splash screen is
 * indefensible for an app somebody may have opened because they can hear water,
 * so this races the probe against a much shorter clock and carries on without it.
 *
 * A late answer is not wasted: it lands in `restorable`, and the onboarding screen
 * offers the old details as long as the user has not started answering. What it
 * will not do is interrupt a half-filled form.
 */
const RESTORE_GRACE_MS = 1_200;

/**
 * What happened when the household tried to report in.
 *
 * A boolean would not do. "We are safe" is the one write in this app whose
 * failure the user must be told about in words, because its whole purpose is to
 * make a control room stop looking for them — and the three ways it can fail lead
 * to three different things to do next.
 */
export type RollCallOutcome =
  | { ok: true; safe_at: string | null }
  | {
      ok: false;
      /**
       * no-profile   — nothing to take off a list; the questions come first
       * not-synced   — the answers never reached Supabase, so there is no row
       * unreachable  — the network refused, and this is worth retrying
       */
      reason: 'no-profile' | 'not-synced' | 'unreachable';
    };

interface HouseholdState {
  gate: HouseholdGate;
  household: StoredHousehold | null;
  /** A profile found on the server that this device has no local copy of. */
  restorable: RestoredHousehold | null;
  /** Stable per install. Null only while the first resolve is in flight. */
  deviceId: string | null;
  /** False when the identifier will not survive an uninstall. See identity.ts. */
  identityIsDurable: boolean;

  /** Write the answers. Resolves true when Supabase has them too. */
  save: (profile: HouseholdProfile) => Promise<boolean>;
  /** Try Supabase again for a profile that is only on this phone. */
  retrySync: () => Promise<boolean>;
  /**
   * Tell the district this household does not need rescue, or take it back.
   *
   * Unlike `save`, nothing is written locally until the server confirms. See the
   * note on the implementation: a local flag that never left the phone would show
   * somebody "the control room knows you are safe" when it does not.
   */
  markSafe: (
    safe: boolean,
    at: { latitude: number; longitude: number } | null,
  ) => Promise<RollCallOutcome>;
  /** "Not now." Remembered, so the questions do not reappear on every launch. */
  decline: () => void;
  /** Reopen the questions from Settings, with the current answers filled in. */
  edit: () => void;
  /** Delete the profile from this device. Does not delete the server's copy. */
  forgetLocal: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdState | null>(null);

export function useHousehold(): HouseholdState {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used inside HouseholdProvider');
  return ctx;
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const [gate, setGate] = useState<HouseholdGate>('loading');
  const [household, setHousehold] = useState<StoredHousehold | null>(null);
  const [restorable, setRestorable] = useState<RestoredHousehold | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [identityIsDurable, setIdentityIsDurable] = useState(false);

  /** Kept so `save` can write without waiting on the identity promise again. */
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    let live = true;

    void (async () => {
      const identity = await deviceIdentity();
      if (!live) return;
      idRef.current = identity.id;
      setDeviceId(identity.id);
      setIdentityIsDurable(identity.durable);

      const [stored, declinedAt] = await Promise.all([
        readJson<StoredHousehold>(StoreKey.household),
        readText(StoreKey.onboardingDeclinedAt),
      ]);
      if (!live) return;

      if (stored) {
        // The ordinary path on every launch after the first. No network, no wait:
        // the answers are already here and the app opens on the alert feed.
        setHousehold(stored);
        setGate('done');
        if (!stored.synced) void sync(identity.id, stored);
        return;
      }

      // Nothing local. Either this is a first run, a reinstall, or somebody who
      // said "not now" last time.
      const probe = restoreHousehold(identity.id).catch(() => null);
      const raced = await Promise.race([
        probe,
        new Promise<undefined>((resolve) =>
          setTimeout(() => resolve(undefined), RESTORE_GRACE_MS),
        ),
      ]);
      if (!live) return;

      if (raced) setRestorable(raced);
      setGate(declinedAt !== null && !raced ? 'done' : 'ask');

      // The probe may still be running. If it answers later it is worth offering,
      // but only where the user has not already started typing — which the
      // onboarding screen decides, since it is the only thing that knows.
      void probe.then((late) => {
        if (live && late) setRestorable(late);
      });
    })();

    return () => {
      live = false;
    };
    // Runs once. `sync` is declared below and is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Push a locally-saved profile to Supabase and record that it landed.
   *
   * Failure is swallowed on purpose. Every caller has already written the answers
   * to disk, so there is nothing to roll back and nothing the user can usefully
   * do about a 2G cell — the `synced: false` flag is the entire error handling,
   * and Settings is where it is surfaced and retried.
   *
   * Resolves to the confirmed copy rather than a boolean because `markSafe` needs
   * it: it has to report in against the row this call just created, carrying the
   * server's stamp rather than the pre-sync one it was holding.
   */
  const sync = useCallback(
    async (id: string, stored: StoredHousehold): Promise<StoredHousehold | null> => {
      try {
        const savedAt = await saveHousehold(id, stored.profile);
        const confirmed: StoredHousehold = {
          ...stored,
          // The server's stamp, not ours. `purge_stale_households` measures
          // retention from `updated_at`, and two clocks disagreeing about when a
          // profile was last confirmed is how something gets deleted early.
          saved_at: typeof savedAt === 'string' ? savedAt : stored.saved_at,
          synced: true,
        };
        await writeJson(StoreKey.household, confirmed);
        setHousehold(confirmed);
        return confirmed;
      } catch {
        return null;
      }
    },
    [],
  );

  const save = useCallback(
    async (profile: HouseholdProfile): Promise<boolean> => {
      const id = idRef.current ?? (await deviceIdentity()).id;
      idRef.current = id;

      const local: StoredHousehold = {
        profile,
        saved_at: new Date().toISOString(),
        synced: false,
        safe_at: household?.safe_at ?? null,
      };

      await writeJson(StoreKey.household, local);
      setHousehold(local);
      setRestorable(null);
      setGate('done');
      // Answering the questions retracts an earlier "not now", so that declining
      // once does not silently suppress the prompt forever after a reinstall.
      await forget(StoreKey.onboardingDeclinedAt);

      return (await sync(id, local)) !== null;
    },
    [household, sync],
  );

  const retrySync = useCallback(async (): Promise<boolean> => {
    if (!household || household.synced) return true;
    const id = idRef.current ?? (await deviceIdentity()).id;
    return (await sync(id, household)) !== null;
  }, [household, sync]);

  /**
   * The roll-call.
   *
   * The order here is the exact opposite of `save`, and deliberately so. `save`
   * writes the disk first because losing five steps of typing to a bad cell is
   * unacceptable and the answers are useful on this phone regardless. This writes
   * nothing until the server has answered, because the flag means "a control room
   * has taken us off the search list" and there is no version of that which is
   * true locally. A cached "we are safe" would be the app telling somebody help is
   * not coming *and* telling the district nothing — the worst of both.
   *
   * An unsynced profile is pushed first rather than refused. `mark_household_safe`
   * raises when there is no row for the device, and "your answers never reached
   * us" is not something to hand back to somebody standing on a first floor
   * waiting for the water to stop.
   */
  const markSafe = useCallback(
    async (
      safe: boolean,
      at: { latitude: number; longitude: number } | null,
    ): Promise<RollCallOutcome> => {
      if (!household) return { ok: false, reason: 'no-profile' };

      const id = idRef.current ?? (await deviceIdentity()).id;
      idRef.current = id;

      let current = household;
      if (!current.synced) {
        const pushed = await sync(id, current);
        if (!pushed) return { ok: false, reason: 'not-synced' };
        current = pushed;
      }

      try {
        const safeAt = await markHouseholdSafe(id, safe, at);
        const next: StoredHousehold = {
          ...current,
          synced: true,
          // Trust the server's stamp. Falling back to our own clock only covers a
          // function that returned nothing, and only for the `safe: true` case —
          // clearing the flag must never leave a timestamp behind.
          safe_at: safe ? safeAt ?? new Date().toISOString() : null,
        };
        await writeJson(StoreKey.household, next);
        setHousehold(next);
        return { ok: true, safe_at: next.safe_at };
      } catch {
        return { ok: false, reason: 'unreachable' };
      }
    },
    [household, sync],
  );

  /**
   * "Not now", remembered.
   *
   * Stamped rather than flagged so a later decision about how long to leave
   * somebody alone can be made from real data. What it does not do is ask again
   * next launch: a safety app that reopens the same form every morning is a safety
   * app people learn to dismiss without reading, and one day the thing they
   * dismiss without reading will be an evacuation notice.
   *
   * The stamp is only written when there is nothing saved. Closing the editor on
   * an existing profile is the same gesture but not the same statement, and
   * recording it as a refusal would misreport what the person did.
   */
  const decline = useCallback(() => {
    setGate('done');
    setRestorable(null);
    if (!household) {
      void writeText(StoreKey.onboardingDeclinedAt, new Date().toISOString());
    }
  }, [household]);

  const edit = useCallback(() => setGate('ask'), []);

  const forgetLocal = useCallback(async () => {
    await forget(StoreKey.household);
    setHousehold(null);
    setGate('done');
    // Declined-stamp too, so "forget" followed by a relaunch offers the questions
    // again rather than looking like the app has quietly given up on them.
    await forget(StoreKey.onboardingDeclinedAt);
  }, []);

  const value = useMemo<HouseholdState>(
    () => ({
      gate,
      household,
      restorable,
      deviceId,
      identityIsDurable,
      save,
      retrySync,
      markSafe,
      decline,
      edit,
      forgetLocal,
    }),
    [
      gate,
      household,
      restorable,
      deviceId,
      identityIsDurable,
      save,
      retrySync,
      markSafe,
      decline,
      edit,
      forgetLocal,
    ],
  );

  return (
    <HouseholdContext.Provider value={value}>
      {children}
    </HouseholdContext.Provider>
  );
}

/**
 * The answers to start the form with: the current profile if there is one, the
 * restorable one if the server had it, and a blank otherwise.
 *
 * Here rather than in the screen because "which of three sources wins" is a
 * statement about the data, and putting it beside the state that holds all three
 * is what stops a fourth source appearing later.
 */
export function startingProfile(state: HouseholdState): HouseholdProfile {
  return state.household?.profile ?? state.restorable?.profile ?? EMPTY_PROFILE;
}
