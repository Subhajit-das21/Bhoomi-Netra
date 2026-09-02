import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomNav, { type TabKey } from './src/components/BottomNav';
import AlertFeed from './src/screens/AlertFeed';
import AlertDetail from './src/screens/AlertDetail';
import ShelterRoute from './src/screens/ShelterRoute';
import ZoneMap from './src/screens/ZoneMap';
import Sos from './src/screens/Sos';
import Settings from './src/screens/Settings';
import CriticalTakeover from './src/screens/CriticalTakeover';
import { CitizenProvider, useCitizen } from './src/state/CitizenProvider';
import type {
  AlertWithContext,
  Hazard,
  ShelterWithRoute,
} from './src/domain/types';

/**
 * The app shell.
 *
 * Navigation is a small explicit state machine rather than a router. react-
 * navigation is not installed and the registry is unreachable from this
 * environment, but the shape of this app does not need one either: four tabs and
 * two screens that push over them. Writing it out means the transitions are
 * readable in one file, and swapping in a real router later is a change to this
 * file alone — every screen already takes plain props and callbacks.
 *
 * Two rules encoded here:
 *
 *   The takeover outranks everything. When a critical alert lands for the zone
 *   the user is standing in, it renders above the tabs and the stack, with no
 *   tab bar underneath, because an alarm you can tab away from is not an alarm.
 *
 *   The walking screen loses the tab bar. Someone following turn-by-turn
 *   directions in a flood should not have a row of other destinations competing
 *   with the next instruction.
 */

type Pushed =
  | { kind: 'alert'; alert: AlertWithContext }
  | { kind: 'route'; shelter: ShelterWithRoute; hazard: Hazard };

export default function App() {
  return (
    <SafeAreaProvider>
      <CitizenProvider>
        <Shell />
      </CitizenProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const {
    takeover,
    acknowledgeTakeover,
    recommendedShelter,
    shelters,
    routeFor,
    containingZone,
    position,
    topAlert,
  } = useCitizen();

  const [tab, setTab] = useState<TabKey>('home');
  const [stack, setStack] = useState<Pushed[]>([]);

  const push = useCallback((next: Pushed) => {
    setStack((s) => [...s, next]);
  }, []);

  const pop = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);

  /** The hazard in play, for screens reached without a specific alert. */
  const ambientHazard: Hazard =
    topAlert?.hazard_type ?? containingZone?.hazard ?? 'flood';

  const openRoute = useCallback(
    (shelter: ShelterWithRoute, hazard: Hazard) =>
      push({ kind: 'route', shelter, hazard }),
    [push],
  );

  // The takeover is checked before anything else, deliberately.
  if (takeover) {
    return (
      <CriticalTakeover
        alert={takeover}
        shelter={recommendedShelter}
        zoneName={containingZone?.name ?? position.locality}
        onRoute={() => {
          acknowledgeTakeover();
          if (recommendedShelter) {
            setStack([
              {
                kind: 'route',
                shelter: recommendedShelter,
                hazard: takeover.hazard_type,
              },
            ]);
          }
        }}
        onAcknowledge={acknowledgeTakeover}
      />
    );
  }

  const top = stack[stack.length - 1] ?? null;

  if (top?.kind === 'route') {
    return (
      <ShelterRoute
        shelter={top.shelter}
        route={routeFor(top.shelter.id)}
        hazard={top.hazard}
        position={position}
        shelters={shelters}
        onBack={pop}
        onSelectShelter={(next) =>
          setStack((s) => [
            ...s.slice(0, -1),
            { kind: 'route', shelter: next, hazard: top.hazard },
          ])
        }
      />
    );
  }

  return (
    <View className="flex-1 bg-paper">
      <View className="flex-1">
        {top?.kind === 'alert' ? (
          <AlertDetail
            alert={top.alert}
            shelter={recommendedShelter}
            onBack={pop}
            onRoute={() =>
              recommendedShelter &&
              openRoute(recommendedShelter, top.alert.hazard_type)
            }
            onOpenMap={() => {
              setStack([]);
              setTab('map');
            }}
          />
        ) : (
          <TabScreen
            tab={tab}
            onOpenAlert={(alert) => push({ kind: 'alert', alert })}
            onOpenMap={() => setTab('map')}
            onRoute={(shelter) => openRoute(shelter, ambientHazard)}
          />
        )}
      </View>

      <BottomNav
        active={tab}
        onChange={(next) => {
          // Changing tab clears the pushed stack: tapping "Alerts" should get
          // you the feed, not the alert you were reading twenty minutes ago.
          setStack([]);
          setTab(next);
        }}
      />
    </View>
  );
}

function TabScreen({
  tab,
  onOpenAlert,
  onOpenMap,
  onRoute,
}: {
  tab: TabKey;
  onOpenAlert: (alert: AlertWithContext) => void;
  onOpenMap: () => void;
  onRoute: (shelter: ShelterWithRoute) => void;
}) {
  switch (tab) {
    case 'home':
      return <AlertFeed onOpenAlert={onOpenAlert} onOpenMap={onOpenMap} />;
    case 'map':
      return <ZoneMap onRoute={onRoute} />;
    case 'sos':
      return <Sos />;
    case 'settings':
      return <Settings />;
  }
}
