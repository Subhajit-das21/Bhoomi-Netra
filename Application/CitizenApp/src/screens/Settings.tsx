import React from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { BellRing, MapPin, Vibrate, WifiOff } from 'lucide-react-native';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { useCitizen } from '../state/CitizenProvider';
import { hasNotificationTransport } from '../services/alarm';
import { clockTime } from '../domain/geo';
import { colors } from '../theme/tokens';

/**
 * Settings, and an honest account of what this app can and cannot currently do.
 *
 * The notification row is the important one. expo-notifications is not installed
 * in this build, so push cannot be delivered — and the app says exactly that
 * rather than showing a toggle that implies a working channel. A safety tool that
 * overstates its reach is worse than one that admits a gap, because someone will
 * put their phone face-down trusting a push that is never coming.
 *
 * The connectivity switch is a review affordance, labelled as one. NetInfo is not
 * installed either, so there is nothing to detect with; flipping this is how the
 * offline, cached and stale states get exercised on a real device.
 */
export default function Settings() {
  const {
    connected,
    setConnected,
    position,
    freshness,
    lastSyncAt,
    replayEscalation,
  } = useCitizen();

  const pushReady = hasNotificationTransport();

  return (
    <Screen>
      <View className="px-4 pt-2 pb-3">
        <Display className="text-title text-ink">Settings</Display>
        <Data className="text-micro text-ink-soft mt-0.5">
          BHOOMI-NETRA citizen alerts
        </Data>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <Group title="Alerts">
          <Row
            icon={BellRing}
            title="Push notifications"
            detail={
              pushReady
                ? 'On. Critical alerts for your ward will reach you with the screen off.'
                : 'Not available in this build. You will only be alerted while the app is open.'
            }
            right={
              <Chip
                label={pushReady ? 'On' : 'Unavailable'}
                fill={pushReady ? 'bg-olive' : 'bg-medium'}
                text="text-paper"
              />
            }
          />

          <Row
            icon={Vibrate}
            title="Vibration for critical alerts"
            detail="On, and not switchable. A critical alert for the zone you are standing in is the one thing this app will not let you silence."
          />

          <View className="pt-3">
            <Button
              label="Test a critical alert"
              variant="secondary"
              onPress={replayEscalation}
            />
            <Body className="text-micro text-ink-soft mt-2 leading-4">
              Plays the real vibration pattern and opens the takeover screen, so
              you know what it looks like before it matters.
            </Body>
          </View>
        </Group>

        <Group title="Location">
          <Row
            icon={MapPin}
            title={position.locality}
            detail={`${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)} — accurate to ${position.accuracyMetres} m. Fix taken ${clockTime(position.takenAt)}.`}
          />
        </Group>

        <Group title="Connection">
          <Row
            icon={WifiOff}
            title="Simulate no signal"
            detail={`Review affordance, not a real setting. Turn it on to see how the app behaves offline. Data is currently ${freshness}, last fetched ${clockTime(lastSyncAt)}.`}
            right={
              <Switch
                value={!connected}
                onValueChange={(v) => setConnected(!v)}
                accessibilityLabel="Simulate no signal"
                trackColor={{ false: colors['paper-deep'], true: colors.high }}
                thumbColor={colors.paper}
                ios_backgroundColor={colors['paper-deep']}
              />
            }
          />
        </Group>

        <Group title="About">
          <Body className="text-body text-ink leading-6">
            BHOOMI-NETRA watches river levels, rainfall, temperature, smoke and
            flame from sensor nodes across the district and warns the people
            nearest to a hazard first.
          </Body>
          <Body className="text-body text-ink leading-6 mt-3">
            It is not a substitute for emergency services. For anything happening
            right now, call 112.
          </Body>
          <Data className="text-micro text-ink-soft mt-4 leading-4">
            Sensor data from the district node network. Zone boundaries and
            shelter status are set by the district authority.
          </Data>
        </Group>
      </ScrollView>
    </Screen>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="px-4 pt-5">
      <Subhead className="text-body text-ink mb-1">{title}</Subhead>
      <View className="border-t border-paper-deep pt-1">{children}</View>
    </View>
  );
}

function Row({
  icon: Icon,
  title,
  detail,
  right,
}: {
  icon: React.ComponentType<{ color: string; size: number; strokeWidth: number }>;
  title: string;
  detail: string;
  right?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-start py-3">
      <View className="mt-0.5">
        <Icon color={colors.ink} size={19} strokeWidth={2.5} />
      </View>
      <View className="flex-1 ml-3">
        <Subhead className="text-body text-ink">{title}</Subhead>
        <Body className="text-meta text-ink-soft mt-1 leading-5">{detail}</Body>
      </View>
      {right ? <View className="ml-3 mt-0.5">{right}</View> : null}
    </View>
  );
}
