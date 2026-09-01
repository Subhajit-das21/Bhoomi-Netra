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
  ALERTS,
  RISK_ZONES,
  ROUTE_TO_DESHAPRIYA,
  SHELTERS,
  USER_POSITION,
} from '../data/fixtures';
import { compareUrgency } from '../domain/severity';
import {
  distanceMetres,
  isInsidePolygon,
  metresToPolygon,
  walkMinutes,
} from '../domain/geo';
import type {
  AlertWithContext,
  DataFreshness,
  RiskZone,
  RouteStep,
  ShelterWithRoute,
  SosState,
  UserPosition,
} from '../domain/types';
import { escalate, stopVibration } from '../services/alarm';

/**
 * Application state for the citizen app.
 *
 * Deliberately a plain Context plus useState: no state library is installed and
 * the registry is unreachable, and at this size one would not earn its weight
 * anyway. Every field a screen needs is derived here so screens stay declarative.
 *
 * Connectivity is a field rather than a detected value. @react-native-community/
 * netinfo is not installed, so real detection is not available; Settings exposes
 * a toggle so the offline states can be reviewed and demonstrated. The seam for
 * the real thing is `setConnected` — a NetInfo listener calls it and nothing
 * else changes.
 */

/** Cached data older than this is labelled stale rather than merely cached. */
const STALE_AFTER_MS = 15 * 60 * 1000;

/** Anything beyond this is too far to walk to in a flood. */
const WALKABLE_LIMIT_M = 2500;

interface CitizenState {
  alerts: AlertWithContext[];
  topAlert: AlertWithContext | null;
  freshness: DataFreshness;
  lastSyncAt: string;
  isRefreshing: boolean;
  position: UserPosition;
  zones: RiskZone[];
  /** The zone the user is standing in, if any. */
  containingZone: RiskZone | null;
  /** Distance to the nearest zone edge when outside one. 0 when inside. */
  nearestZoneMetres: number;
  shelters: ShelterWithRoute[];
  recommendedShelter: ShelterWithRoute | null;
  route: RouteStep[];
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

export function CitizenProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date().toISOString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [sos, setSos] = useState<SosState>('idle');
  const [takeover, setTakeover] = useState<AlertWithContext | null>(null);
  const [position] = useState<UserPosition>(USER_POSITION);

  /** Alerts already escalated, so a re-render cannot re-buzz the phone. */
  const escalated = useRef<Set<string>>(new Set());

  const alerts = useMemo(() => [...ALERTS].sort(compareUrgency), []);
  const topAlert = alerts[0] ?? null;

  /** Re-tick every 30s so relative timestamps and staleness stay honest. */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const freshness: DataFreshness = useMemo(() => {
    const age = now - Date.parse(lastSyncAt);
    if (connected) return 'live';
    if (age > STALE_AFTER_MS) return 'stale';
    return 'cached';
  }, [connected, lastSyncAt, now]);

  const containingZone = useMemo(
    () => RISK_ZONES.find((z) => isInsidePolygon(position, z.polygon)) ?? null,
    [position],
  );

  const nearestZoneMetres = useMemo(() => {
    if (containingZone) return 0;
    return Math.min(
      ...RISK_ZONES.map((z) => metresToPolygon(position, z.polygon)),
    );
  }, [containingZone, position]);

  const shelters = useMemo<ShelterWithRoute[]>(() => {
    return SHELTERS.map((s) => {
      const metres = distanceMetres(position, s);
      return {
        ...s,
        distanceMetres: metres,
        walkMinutes: walkMinutes(metres),
        // A route is risky if it starts inside a zone the shelter is not in.
        routeCrossesRisk:
          containingZone !== null &&
          isInsidePolygon(position, containingZone.polygon) &&
          !isInsidePolygon(s, containingZone.polygon),
      };
    }).sort((a, b) => a.distanceMetres - b.distanceMetres);
  }, [containingZone, position]);

  /**
   * Nearest open shelter within walking range, preferring higher ground when
   * the hazard is a flood. A full shelter is never recommended.
   */
  const recommendedShelter = useMemo(() => {
    const reachable = shelters.filter(
      (s) => s.status === 'open' && s.distanceMetres <= WALKABLE_LIMIT_M,
    );
    if (reachable.length === 0) return shelters.find((s) => s.status === 'open') ?? null;
    return reachable.reduce((best, s) =>
      s.elevationMetres > best.elevationMetres + 0.5 &&
      s.distanceMetres < WALKABLE_LIMIT_M
        ? s
        : best,
    );
  }, [shelters]);

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

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    // Stands in for the Supabase query. A failed fetch is what would flip
    // `connected` to false in the real client.
    await new Promise((resolve) => setTimeout(resolve, 900));
    if (connected) setLastSyncAt(new Date().toISOString());
    setNow(Date.now());
    setIsRefreshing(false);
  }, [connected]);

  const startSos = useCallback(() => {
    setSos('sending');
    setTimeout(() => {
      // Offline, the message cannot leave now — it is queued for SMS instead of
      // being reported as sent, because a false "sent" is dangerous.
      setSos(connected ? 'sent' : 'queued');
    }, 1600);
  }, [connected]);

  const cancelSos = useCallback(() => setSos('idle'), []);

  const acknowledgeTakeover = useCallback(() => {
    stopVibration();
    setTakeover(null);
  }, []);

  /** Settings affordance: replay the critical escalation to review the behaviour. */
  const replayEscalation = useCallback(() => {
    const critical = alerts.find((a) => a.severity === 'critical');
    if (!critical) return;
    escalated.current.delete(critical.id);
    setTakeover(critical);
    void escalate(
      critical.id,
      critical.hazard_type,
      `Leave now — ${containingZone?.name ?? position.locality}`,
    );
  }, [alerts, containingZone, position.locality]);

  const value = useMemo<CitizenState>(
    () => ({
      alerts,
      topAlert,
      freshness,
      lastSyncAt,
      isRefreshing,
      position,
      zones: RISK_ZONES,
      containingZone,
      nearestZoneMetres,
      shelters,
      recommendedShelter,
      route: ROUTE_TO_DESHAPRIYA,
      sos,
      takeover,
      connected,
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
      position,
      containingZone,
      nearestZoneMetres,
      shelters,
      recommendedShelter,
      sos,
      takeover,
      connected,
      refresh,
      startSos,
      cancelSos,
      acknowledgeTakeover,
      replayEscalation,
    ],
  );

  return (
    <CitizenContext.Provider value={value}>{children}</CitizenContext.Provider>
  );
}
