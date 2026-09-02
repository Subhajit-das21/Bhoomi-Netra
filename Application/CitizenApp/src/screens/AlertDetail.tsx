import React from 'react';
import { ScrollView, View } from 'react-native';
import {
  CloudRain,
  Droplets,
  Flame,
  Map,
  Navigation,
  Thermometer,
  Wind,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Screen from '../components/ui/Screen';
import TopBar from '../components/ui/TopBar';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import SensorTile from '../components/SensorTile';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { SEVERITY, directive, HAZARD_LABEL } from '../domain/severity';
import { evidence, headline, proximity } from '../domain/copy';
import { clockTime, formatDistance, timeAgo, walkMinutes } from '../domain/geo';
import { colors } from '../theme/tokens';
import type {
  AlertWithContext,
  Hazard,
  Reading,
  Severity,
  ShelterWithRoute,
} from '../domain/types';

interface AlertDetailProps {
  alert: AlertWithContext;
  shelter: ShelterWithRoute | null;
  onBack: () => void;
  onRoute: () => void;
  onOpenMap: () => void;
}

/**
 * One alert, in full.
 *
 * The order of this screen is the order of the questions someone actually asks,
 * and it is not the order a database would suggest:
 *
 *   1. How bad, how near, how old        — the header field
 *   2. What do I do                       — the directive, then the button
 *   3. What do I take                     — because people leave without medicine
 *   4. Why should I believe this          — the sensor evidence, last
 *
 * Evidence goes last deliberately. It matters — an alert nobody believes is an
 * alert nobody acts on — but a person deciding whether to leave their house
 * should not have to scroll past an ADC count to find the instruction.
 */
export default function AlertDetail({
  alert,
  shelter,
  onBack,
  onRoute,
  onOpenMap,
}: AlertDetailProps) {
  const s = SEVERITY[alert.severity];
  const HazardIcon = alert.hazard_type === 'fire' ? Flame : Droplets;
  const isCritical = alert.severity === 'critical';
  const lines = alert.trigger ? evidence(alert.trigger, alert.hazard_type) : [];
  const tiles = alert.trigger
    ? sensorTiles(alert.trigger, alert.hazard_type, alert.severity)
    : [];

  return (
    <Screen>
      <TopBar backLabel="Alerts" onBack={onBack} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        {/* The header carries the severity as a field of colour, the same way the
            feed card does, so arriving here from the feed feels continuous. */}
        <View className={`px-4 pt-4 pb-5 ${s.card}`}>
          <View className="flex-row items-center">
            <Chip
              label={s.label}
              fill={s.chip}
              text={s.chipText}
              icon={HazardIcon}
              iconColor={isCritical ? s.accent : colors.paper}
            />
            <Data className={`text-micro ml-2 ${s.meta}`}>
              {timeAgo(alert.created_at)}
            </Data>
          </View>

          <Display className={`text-display mt-3 ${s.title}`}>
            {headline(alert)}
          </Display>

          <Data className={`text-body mt-2 ${s.meta}`}>
            {proximity(alert)}
          </Data>
        </View>

        <Section title="What to do">
          <Body className="text-body-lg text-ink leading-7">
            {directive(alert.hazard_type, alert.severity)}
          </Body>

          {shelter ? (
            <View className="mt-4">
              <Button
                label={`Walk to ${shelter.name}`}
                icon={Navigation}
                variant={isCritical ? 'danger' : 'primary'}
                onPress={onRoute}
              />
              <Data className="text-meta text-ink-soft mt-2">
                {`${formatDistance(shelter.distanceMetres)}, about ${walkMinutes(shelter.distanceMetres)} min on foot`}
              </Data>
            </View>
          ) : null}

          <View className="mt-3">
            <Button
              label="See the zone on the map"
              icon={Map}
              variant="secondary"
              onPress={onOpenMap}
            />
          </View>
        </Section>

        <Rule />

        <Section title="Take with you">
          {TAKE_WITH_YOU.map((item) => (
            <View key={item} className="flex-row mt-2">
              <View className="w-1.5 h-1.5 rounded-full bg-ink-soft mt-2 mr-3" />
              <Body className="text-body text-ink flex-1 leading-6">{item}</Body>
            </View>
          ))}
          <Body className="text-meta text-ink-soft mt-3 leading-5">
            Leave everything else. Things can be replaced.
          </Body>
        </Section>

        <Rule />

        <Section title="Why you are seeing this">
          {tiles.length > 0 ? (
            <View className="flex-row flex-wrap -mx-1 mb-3">
              {tiles.map((t) => (
                <View key={t.label} className="w-1/2 mb-2">
                  <SensorTile
                    icon={t.icon}
                    label={t.label}
                    value={t.value}
                    unit={t.unit}
                    status={t.status}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {lines.length > 0 ? (
            lines.map((line) => (
              <Body key={line} className="text-body text-ink mt-1.5 leading-6">
                {line}
              </Body>
            ))
          ) : (
            <Body className="text-body text-ink leading-6">
              This warning was issued by the district authority rather than by a
              sensor reading.
            </Body>
          )}

          <View className="mt-4 rounded-md bg-paper-deep p-3">
            <Data className="text-micro text-ink-soft leading-4">
              {`Reported by ${alert.node.name}`}
            </Data>
            <Data className="text-micro text-ink-soft leading-4 mt-1">
              {`${HAZARD_LABEL[alert.hazard_type]} sensor, ${alert.node.node_type} node, ${alert.node.status}`}
            </Data>
            <Data className="text-micro text-ink-soft leading-4 mt-1">
              {`Recorded at ${clockTime(alert.created_at)}`}
            </Data>
          </View>
        </Section>
      </ScrollView>
    </Screen>
  );
}

/**
 * Not numbered. These are four things to grab in any order, and "01 / 02 / 03"
 * would imply a sequence that does not exist.
 */
const TAKE_WITH_YOU = [
  'Phone and charger, or a power bank',
  'Any medicines you take daily',
  'Aadhaar or another ID, and some cash',
  'Drinking water, and a torch if you have one',
];

/**
 * The trigger reading as tiles.
 *
 * Only the sensor that defines the hazard carries the alert's severity; the rest
 * read 'ok'. The per-sensor thresholds live in the database trigger
 * (supabase/migrations/004_alert_trigger.sql) and are deliberately not duplicated
 * here — two copies of a threshold is two thresholds, and the one on the phone
 * would be the stale one.
 */
function sensorTiles(
  reading: Reading,
  hazard: Hazard,
  severity: Severity,
): { icon: LucideIcon; label: string; value: string; unit: string; status: 'ok' | Severity }[] {
  const tiles: {
    icon: LucideIcon;
    label: string;
    value: string;
    unit: string;
    status: 'ok' | Severity;
  }[] = [];

  if (hazard === 'flood') {
    if (reading.water_level !== null) {
      tiles.push({
        icon: Droplets,
        label: 'Water level',
        value: String(reading.water_level),
        unit: '/4095',
        status: severity,
      });
    }
    if (reading.rain_level !== null) {
      tiles.push({
        icon: CloudRain,
        label: 'Rainfall',
        value: String(reading.rain_level),
        unit: '/4095',
        status: 'ok',
      });
    }
    if (reading.humidity !== null) {
      tiles.push({
        icon: Droplets,
        label: 'Humidity',
        value: reading.humidity.toFixed(0),
        unit: '%',
        status: 'ok',
      });
    }
    return tiles;
  }

  if (reading.flame_detected !== null) {
    tiles.push({
      icon: Flame,
      label: 'Flame sensor',
      value: reading.flame_detected ? 'Triggered' : 'Clear',
      unit: '',
      status: reading.flame_detected ? severity : 'ok',
    });
  }
  if (reading.smoke_level !== null) {
    tiles.push({
      icon: Wind,
      label: 'Smoke',
      value: String(reading.smoke_level),
      unit: '/4095',
      status: reading.flame_detected ? 'ok' : severity,
    });
  }
  if (reading.temperature !== null) {
    tiles.push({
      icon: Thermometer,
      label: 'Temperature',
      value: reading.temperature.toFixed(1),
      unit: '°C',
      status: 'ok',
    });
  }
  return tiles;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="px-4 pt-5">
      <Subhead className="text-title text-ink mb-2">{title}</Subhead>
      {children}
    </View>
  );
}

/** A hairline, the way a printed page separates blocks. No card, no shadow. */
function Rule() {
  return <View className="h-px bg-paper-deep mx-4 mt-5" />;
}
