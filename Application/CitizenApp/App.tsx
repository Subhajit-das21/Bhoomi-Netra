import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BottomNav, { type TabKey } from './src/components/BottomNav';
import Screen from './src/components/ui/Screen';
import { Body, Display } from './src/components/ui/Type';
import AlertFeed from './src/screens/AlertFeed';
import AlertDetail from './src/screens/AlertDetail';
import ShelterRoute from './src/screens/ShelterRoute';
import ZoneMap from './src/screens/ZoneMap';
import Sos from './src/screens/Sos';
import Settings from './src/screens/Settings';
import Onboarding from './src/screens/Onboarding';
import CriticalTakeover from './src/screens/CriticalTakeover';
import { CitizenProvider, useCitizen } from './src/state/CitizenProvider';
import { HouseholdProvider, useHousehold } from './src/state/HouseholdProvider';
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
 * Three rules encoded here:
 *
 *   The takeover outranks everything, including the household questions. When a
 *   critical alert lands for the zone the user is standing in, it renders above
 *   the tabs, the stack and the onboarding flow, with no tab bar underneath,
 *   because an alarm you can tab away from is not an alarm — and a form is a worse
 *   thing to be looking at than a tab bar.
 *
 *   The household gate comes next, and only on a first run. Once there is a
 *   profile — or a "not now" on record — it never renders again unless Settings
 *   asks for it.
 *
 *   The walking screen loses the tab bar. Someone following turn-by-turn
 *   directions in a flood should not have a row of other destinations competing
 *   with the next instruction.
 *
 * HouseholdProvider wraps CitizenProvider rather than the other way round. Phase 3
 * needs the household inside the citizen state — `recommendedShelter` cannot ask
 * whether a hall has room for seven without knowing there are seven — and this
 * nesting makes that one hook call instead of a refactor.
 */

type Pushed =
  | { kind: 'alert'; alert: AlertWithContext }
  | { kind: 'route'; shelter: ShelterWithRoute; hazard: Hazard };

export default function App() {
  return (
    <SafeAreaProvider>
      <HouseholdProvider>
        <CitizenProvider>
          <Shell />
        </CitizenProvider>
      </HouseholdProvider>
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
    ambientHazard,
  } = useCitizen();
  const { gate } = useHousehold();

  const [tab, setTab] = useState<TabKey>('home');
  const [stack, setStack] = useState<Pushed[]>([]);

  const push = useCallback((next: Pushed) => {
    setStack((s) => [...s, next]);
  }, []);

  const pop = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);

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

  if (gate === 'loading') return <Opening />;
  if (gate === 'ask') return <Onboarding />;

  const top = stack[stack.length - 1] ?? null;

  if (top?.kind === 'route') {
    return (
      <ShelterRoute
        // Keyed by shelter so picking a different hall remounts the screen.
        // Without this, React reuses the instance and the walk to Netaji Indoor
        // Stadium opens at step 4 of the walk to Deshapriya Park — or worse, on
        // "you have arrived".
        key={top.shelter.id}
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

/**
 * The first frame, which normally lasts a few milliseconds: one AsyncStorage read
 * and a synchronous device-id lookup.
 *
 * Not a spinner. There is nothing here worth animating and nothing for the user to
 * wait on — but returning null would flash the window's default white behind a
 * cream app, which is a visible defect on a slow first launch. So it holds the
 * ground and says what the app is.
 *
 * On a first run with no profile this can stretch to the restore probe's grace
 * period, a little over a second. That is the longest this screen is ever shown,
 * and it is capped in HouseholdProvider rather than here.
 */
function Opening() {
  return (
    <Screen>
      <View className="flex-1 px-6 justify-center">
        <Display className="text-display text-ink">BHOOMI-NETRA</Display>
        <Body className="text-body-lg text-ink-soft leading-7 mt-2">
          Flood and fire warnings for your ward.
        </Body>
      </View>
    </Screen>
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
