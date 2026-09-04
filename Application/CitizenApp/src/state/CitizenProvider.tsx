import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DEVICE_POSITION } from '../data/device';
import {
  fetchAlerts,
  fetchRiskZones,
  fetchRoutes,
  fetchShelters,
} from '../data/queries';
import { SupabaseError, isSupabaseConfigured } from '../services/supabase';
import { compareUrgency } from '../domain/severity';
import {
  chooseShelter,
  needsOf,
  type HouseholdNeeds,
  type ShelterChoice,
} from '../domain/shelter';
import { useHousehold } from './HouseholdProvider';
import {
  distanceMetres,
  isInsidePolygon,
  metresToPolygon,
  walkMinutes,
} from '../domain/geo';
import type {
  AlertWithContext,
  DataFreshness,
  Hazard,
  LoadFailure,
  LoadState,
  RiskZone,
  RouteStep,
  Shelter,
  ShelterWithRoute,
  SosState,
  UserPosition,
} from '../domain/types';
import { escalate, stopVibration } from '../services/alarm';

/**
 * Application state for the citizen app.
 *
 * Every alert, shelter, zone and walking route on screen comes from Supabase.
 * Nothing about the district is compiled into this binary any more, which is the
 * point: a shelter roster inside an APK is a roster nobody can correct while the
 * water is rising. The one local value left is the user's position, and
 * data/device.ts explains why.
 *
 * Deliberately a plain Context plus useState: no state library is installed and
 * the registry is unreachable, and at this size one would not earn its weight
 * anyway. Every field a screen needs is derived here so screens stay declarative.
 *
 * ------------------------------------------------------------------
 * The cache is the session
 * ------------------------------------------------------------------
 * `snapshot` below is the entire cache, and it lives in memory. No AsyncStorage,
 * expo-file-system or expo-sqlite is installed, so a cold start with no signal
 * genuinely has nothing to show and says so. That is worse than a disk cache and
 * better than the alternative I rejected: keeping the old fixtures as a fallback
 * would fill the screen by naming a shelter that may have closed hours ago.
 */

/** Cached data older than this is labelled stale rather than merely cached. */
const STALE_AFTER_MS = 15 * 60 * 1000;

/** Everything one fetch round brings back. Replaced wholesale, never merged. */
interface Snapshot {
  alerts: AlertWithContext[];
  shelters: Shelter[];
  zones: RiskZone[];
  routes: Record<string, RouteStep[]>;
  at: string;
}

interface CitizenState {
  alerts: AlertWithContext[];
  topAlert: AlertWithContext | null;
  freshness: DataFreshness;
  lastSyncAt: string;
  isRefreshing: boolean;
  /** Whether there is anything to show yet. Screens branch on this first. */
  loadState: LoadState;
  /** Why the last attempt failed, or null. Set even while stale data is shown. */
  failure: LoadFailure | null;
  position: UserPosition;
  zones: RiskZone[];
  /** The zone the user is standing in, if any. */
  containingZone: RiskZone | null;
  /**
   * Distance to the nearest zone edge when outside one. 0 when inside, and
   * Infinity when the district has published no zones at all — which is a real
   * state, not an error, and reads differently on screen.
   */
  nearestZoneMetres: number;
  shelters: ShelterWithRoute[];
  recommendedShelter: ShelterWithRoute | null;
  /**
   * The recommendation with its compromises attached — whether it has room for
   * everybody, whether it is walkable, whether it has the care this household
   * said it needs. Null whenever `recommendedShelter` is.
   */
  shelterChoice: ShelterChoice | null;
  /** The household reduced to what shelter choice and advice can act on. */
  householdNeeds: HouseholdNeeds;
  /**
   * The hazard in play, for screens reached without a specific alert: what is
   * being warned about, or failing that what the zone underfoot is marked for.
   * Defaults to flood, which is what this district's zones are mostly about.
   */
  ambientHazard: Hazard;
  /**
   * Turn-by-turn steps for a specific shelter, or an empty array when we have
   * none. Returning another shelter's directions would be worse than returning
   * nothing, so this never falls back.
   */
  routeFor: (shelterId: string) => RouteStep[];
  sos: SosState;
  /** Set when a critical alert has escalated and not yet been acknowledged. */
  takeover: AlertWithContext | null;
  connected: boolean;
  setConnected: (value: boolean) => void;
  refresh: () => Promise<void>;
  startSos: () => void;
  cancelSos: () => void;
  acknowledgeTakeover: () => void;
  replayEscalation: () => void;
}

const CitizenContext = createContext<CitizenState | null>(null);

export function useCitizen(): CitizenState {
  const ctx = useContext(CitizenContext);
  if (!ctx) throw new Error('useCitizen must be used inside CitizenProvider');
  return ctx;
}

/** SupabaseError.kind, in the terms the interface distinguishes. */
function asFailure(error: unknown): LoadFailure {
  if (!(error instanceof SupabaseError)) return 'server';
  switch (error.kind) {
    case 'config':
      return 'unconfigured';
    case 'offline':
    case 'timeout':
      return 'unreachable';
    case 'server':
      return 'server';
  }
}

export function CitizenProvider({ children }: { children: React.ReactNode }) {
  /**
   * Read, never written. HouseholdProvider wraps this one in App.tsx precisely so
   * that shelter choice can ask how many people are in the house; the write path
   * stays where the store and the device id are.
   */
  const { household } = useHousehold();

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('first-load');
  const [failure, setFailure] = useState<LoadFailure | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sos, setSos] = useState<SosState>('idle');
  const [takeover, setTakeover] = useState<AlertWithContext | null>(null);
  const [position] = useState<UserPosition>(DEVICE_POSITION);

  /**
   * Simulated signal, and only ever simulated. NetInfo is not installed so there
   * is nothing to detect with; the real evidence is whether a fetch succeeded,
   * which is what `failure` records. This flag is the Settings switch, and
   * turning it off makes `load` refuse to fetch so the offline states can be
   * exercised on a real device.
   */
  const [signalEnabled, setSignalEnabled] = useState(true);

  /** Alerts already escalated, so a re-render cannot re-buzz the phone. */
  const escalated = useRef<Set<string>>(new Set());

  /** Re-tick every 30s so relative timestamps and staleness stay honest. */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /**
   * One fetch round. All four reads go together because the app is not usable
   * with three of them: a shelter list without zones cannot say whether the walk
   * crosses water, and an alert feed without shelters has nowhere to send anyone.
   * Partial success would mean deciding which half of a safety screen to lie
   * about, so a failure in any of them leaves the previous snapshot standing.
   */
  const load = useCallback(async () => {
    if (!signalEnabled) {
      setFailure('unreachable');
      setLoadState((s) => (s === 'first-load' ? 'failed' : s));
      setNow(Date.now());
      return;
    }

    try {
      const [alerts, shelters, zones, routes] = await Promise.all([
        fetchAlerts(position),
        fetchShelters(),
        fetchRiskZones(),
        fetchRoutes(),
      ]);
      setSnapshot({
        alerts,
        shelters,
        zones,
        routes,
        at: new Date().toISOString(),
      });
      setFailure(null);
      setLoadState('ready');
    } catch (error) {
      setFailure(asFailure(error));
      // A failed refresh with data already on screen is not a failed load. The
      // rows stay, and `freshness` drops to cached or stale to say how much to
      // trust them.
      setLoadState((s) => (s === 'ready' ? 'ready' : 'failed'));
    } finally {
      setNow(Date.now());
    }
  }, [position, signalEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  /**
   * Flipping the switch back on refetches rather than waiting for the next pull.
   * Someone who has just regained signal is the person least willing to wait.
   */
  const setConnected = useCallback((value: boolean) => {
    setSignalEnabled(value);
  }, []);

  const lastSyncAt = snapshot?.at ?? position.takenAt;

  const freshness: DataFreshness = useMemo(() => {
    if (snapshot === null) return 'offline';
    if (failure === null) return 'live';
    const age = now - Date.parse(snapshot.at);
    return age > STALE_AFTER_MS ? 'stale' : 'cached';
  }, [snapshot, failure, now]);

  const alerts = useMemo(
    () => [...(snapshot?.alerts ?? [])].sort(compareUrgency),
    [snapshot],
  );
  const topAlert = alerts[0] ?? null;
  const zones = snapshot?.zones ?? [];

  const containingZone = useMemo(
    () => zones.find((z) => isInsidePolygon(position, z.polygon)) ?? null,
    [zones, position],
  );

  const nearestZoneMetres = useMemo(() => {
    if (containingZone) return 0;
    // Math.min() of nothing is Infinity, which is the right answer here but only
    // by accident, so it is stated rather than relied upon.
    if (zones.length === 0) return Infinity;
    return Math.min(...zones.map((z) => metresToPolygon(position, z.polygon)));
  }, [containingZone, zones, position]);

  /**
   * What is being warned about. Live alerts outrank the map: a fire alert while
   * standing in a flood zone is a fire, and the zone underfoot is only the answer
   * when nothing is currently sounding.
   *
   * Computed here rather than in App.tsx, which had its own copy — two
   * definitions of "which hazard is this" is how the shelter ranking and the
   * screen it is shown on end up disagreeing.
   */
  const ambientHazard: Hazard =
    topAlert?.hazard_type ?? containingZone?.hazard_type ?? 'flood';

  const householdNeeds = useMemo(
    () => needsOf(household?.profile ?? null),
    [household],
  );

  const shelters = useMemo<ShelterWithRoute[]>(() => {    return (snapshot?.shelters ?? [])
      .map((s) => {
        const metres = distanceMetres(position, s);
        return {
          ...s,
          distanceMetres: metres,
          walkMinutes: walkMinutes(metres),
          // A route is risky if it starts inside a zone the shelter is not in.
          routeCrossesRisk:
            containingZone !== null &&
            !isInsidePolygon(s, containingZone.polygon),
        };
      })
      .sort((a, b) => a.distanceMetres - b.distanceMetres);
  }, [snapshot, containingZone, position]);

  /**
   * The shelter to send this household to.
   *
   * The reasoning is in domain/shelter.ts, where it can be asserted against by
   * hand. What matters here is that it is finally household-aware: until the
   * profile existed this ranked by distance and elevation alone and would send a
   * family of seven to a hall with four places left, which is how a household
   * gets split up at a shelter door in the dark.
   */
  const shelterChoice = useMemo(
    () => chooseShelter(shelters, householdNeeds, ambientHazard),
    [shelters, householdNeeds, ambientHazard],
  );

  const recommendedShelter = shelterChoice?.shelter ?? null;

  /**
   * Escalation. When a critical alert applies to the zone the user is standing
   * in, vibrate and raise the takeover once — never on every render.
   */
  useEffect(() => {
    if (!topAlert || topAlert.severity !== 'critical') return;
    if (!containingZone) return;
    if (escalated.current.has(topAlert.id)) return;

    escalated.current.add(topAlert.id);
    setTakeover(topAlert);
    void escalate(
      topAlert.id,
      topAlert.hazard_type,
      `Leave now — ${containingZone.name}`,
    );
  }, [topAlert, containingZone]);

  const startSos = useCallback(() => {
    setSos('sending');
    setTimeout(() => {
      // Offline, the message cannot leave now — it is queued for SMS instead of
      // being reported as sent, because a false "sent" is dangerous.
      setSos(signalEnabled && failure === null ? 'sent' : 'queued');
    }, 1600);
  }, [signalEnabled, failure]);

  const cancelSos = useCallback(() => setSos('idle'), []);

  /**
   * Steps for one shelter only. No fallback by design: shelter_routes is a
   * partial table because a district surveys routes to the halls it actually
   * evacuates people to, and the screen renders an honest direction-only state on
   * an empty array. Serving one shelter's streets under another's name would walk
   * someone to the wrong building while sounding certain about it.
   */
  const routeFor = useCallback(
    (shelterId: string) => snapshot?.routes[shelterId] ?? [],
    [snapshot],
  );

  const acknowledgeTakeover = useCallback(() => {
    stopVibration();
    setTakeover(null);
  }, []);

  /**
   * Settings affordance: play the critical escalation so someone knows what it
   * looks like before it matters.
   *
   * This synthesizes a local drill alert rather than promoting a real one, and it
   * has to. The database trigger in 004_alert_trigger.sql tops out at 'high', so
   * searching the live feed for a 'critical' alert would find nothing on most
   * days and the button would silently do nothing — a test control that only
   * works during an actual emergency is not a test control.
   *
   * The drill never enters `alerts`, so it cannot reach the feed, and its message
   * says it is a test in the first sentence. Someone handing their phone to a
   * relative mid-demonstration should not cause a second emergency.
   */
  const replayEscalation = useCallback(() => {
    const hazard =
      containingZone?.hazard_type ?? topAlert?.hazard_type ?? 'flood';
    const place = containingZone?.name ?? position.locality;
    const drill: AlertWithContext = {
      id: 'drill-local',
      node_id: 'drill-local',
      hazard_type: hazard,
      severity: 'critical',
      message: `This is a test of the critical alert. No warning is active for ${place} right now.`,
      resolved: false,
      created_at: new Date().toISOString(),
      node: {
        id: 'drill-local',
        name: position.locality,
        node_type: 'universal',
        latitude: position.latitude,
        longitude: position.longitude,
        status: 'test',
      },
      distanceMetres: 0,
      trigger: null,
    };
    setTakeover(drill);
    void escalate(drill.id, hazard, `Test alert — ${place}`);
  }, [containingZone, topAlert, position]);

  const value = useMemo<CitizenState>(
    () => ({
      alerts,
      topAlert,
      freshness,
      lastSyncAt,
      isRefreshing,
      loadState,
      failure,
      position,
      zones,
      containingZone,
      nearestZoneMetres,
      shelters,
      recommendedShelter,
      shelterChoice,
      householdNeeds,
      ambientHazard,
      routeFor,
      sos,
      takeover,
      connected: signalEnabled,
      setConnected,
      refresh,
      startSos,
      cancelSos,
      acknowledgeTakeover,
      replayEscalation,
    }),
    [
      alerts,
      topAlert,
      freshness,
      lastSyncAt,
      isRefreshing,
      loadState,
      failure,
      position,
      zones,
      containingZone,
      nearestZoneMetres,
      shelters,
      recommendedShelter,
      shelterChoice,
      householdNeeds,
      ambientHazard,
      sos,      takeover,
      signalEnabled,
      setConnected,
      refresh,
      startSos,
      cancelSos,
      routeFor,
      acknowledgeTakeover,
      replayEscalation,
    ],
  );

  return (
    <CitizenContext.Provider value={value}>{children}</CitizenContext.Provider>
  );
}

/**
 * Re-exported so screens can name the missing-credentials case without importing
 * the transport layer. `loadState === 'failed'` with `failure === 'unconfigured'`
 * is the only failure a citizen cannot retry their way out of, and the copy for
 * it has to say so.
 */
export { isSupabaseConfigured };

