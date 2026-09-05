import React, { useState } from 'react';
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
import Sparkline from '../components/Sparkline';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { SEVERITY, directive, hazardLabel, severityLabel } from '../domain/severity';
import {
  evidence,
  headline,
  overMinutes,
  proximity,
  trendRate,
  trendSentence,
} from '../domain/copy';
import { hazardTrend } from '../domain/trend';
import { clockTime, formatDistance, timeAgo, walkMinutes } from '../domain/geo';
import { t as translate } from '../domain/i18n';
import { useText } from '../state/useText';
import { colors } from '../theme/tokens';
import type {
  AlertWithContext,
  Hazard,
  Language,
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
 *   3. Which way is it going              — the trend, because "76%" is not a verb
 *   4. What do I take                     — because people leave without medicine
 *   5. Why should I believe this          — the sensor evidence, last
 *
 * Evidence goes last deliberately. It matters — an alert nobody believes is an
 * alert nobody acts on — but a person deciding whether to leave their house
 * should not have to scroll past an ADC count to find the instruction.
 *
 * The trend sits third rather than with the evidence because it is not evidence:
 * whether the water is still climbing is an input to the decision the directive
 * above it asks for, and somebody who reads "move to higher ground" needs to know
 * within the same screenful whether they have twenty minutes or two.
 */
export default function AlertDetail({
  alert,
  shelter,
  onBack,
  onRoute,
  onOpenMap,
}: AlertDetailProps) {
  const { lang, t } = useText();
  const s = SEVERITY[alert.severity];
  const HazardIcon = alert.hazard_type === 'fire' ? Flame : Droplets;
  const isCritical = alert.severity === 'critical';
  const lines = alert.trigger
    ? evidence(alert.trigger, alert.hazard_type, lang)
    : [];
  const tiles = alert.trigger
    ? sensorTiles(alert.trigger, alert.hazard_type, alert.severity, lang)
    : [];

  // Recomputed on each render rather than memoised: `history` is at most 200 rows
  // narrowed to 24, and this screen re-renders when the user scrolls it, not on a
  // timer.
  const trend = hazardTrend(alert.history, alert.hazard_type);
  const rate = trend ? trendRate(trend.trend, lang) : null;

  // SVG needs a pixel width and Flex will not tell anyone what it decided, so the
  // panel measures itself and the line draws on the second pass. Zero until then,
  // which Sparkline renders as nothing rather than as a spike at x=0.
  const [chartWidth, setChartWidth] = useState(0);

  return (
    <Screen>
      <TopBar backLabel={t('Alerts')} onBack={onBack} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 36 }}
      >
        {/* The header carries the severity as a field of colour, the same way the
            feed card does, so arriving here from the feed feels continuous. */}
        <View className={`px-4 pt-4 pb-5 ${s.card}`}>
          <View className="flex-row items-center">
            <Chip
              label={severityLabel(alert.severity, lang)}
              fill={s.chip}
              text={s.chipText}
              icon={HazardIcon}
              iconColor={isCritical ? s.accent : colors.paper}
            />
            <Data className={`text-micro ml-2 ${s.meta}`}>
              {timeAgo(alert.created_at, Date.now(), lang)}
            </Data>
          </View>

          <Display className={`text-display mt-3 ${s.title}`}>
            {headline(alert, lang)}
          </Display>

          <Data className={`text-body mt-2 ${s.meta}`}>
            {proximity(alert, lang)}
          </Data>
        </View>

        <Section title={t('What to do')}>
          <Body className="text-body-lg text-ink leading-7">
            {directive(alert.hazard_type, alert.severity, lang)}
          </Body>

          {shelter ? (
            <View className="mt-4">
              <Button
                label={t('Walk to {shelter}', { shelter: shelter.name })}
                icon={Navigation}
                variant={isCritical ? 'danger' : 'primary'}
                onPress={onRoute}
              />
              <Data className="text-meta text-ink-soft mt-2">
                {t('{distance}, about {minutes} min on foot', {
                  distance: formatDistance(shelter.distanceMetres, lang),
                  minutes: walkMinutes(shelter.distanceMetres),
                })}
              </Data>
            </View>
          ) : null}

          <View className="mt-3">
            <Button
              label={t('See the zone on the map')}
              icon={Map}
              variant="secondary"
              onPress={onOpenMap}
            />
          </View>
        </Section>

        {trend ? (
          <>
            <Rule />
            {/* Titled neutrally on purpose. `trendSentence` already opens with
                "Still rising" or "Falling back", and a heading that said the same
                thing would spend a line repeating itself. */}
            <Section title={t('Which way it is going')}>
              <View
                className="rounded-md bg-paper-deep px-3 pt-3 pb-2"
                onLayout={(e) => setChartWidth(e.nativeEvent.layout.width - 24)}
              >
                <Sparkline trend={trend.trend} width={chartWidth} />
                <View className="flex-row justify-between mt-1">
                  <Data className="text-micro text-ink-soft">
                    {t('{span} ago', {
                      span: overMinutes(trend.trend.spanMinutes, lang),
                    })}
                  </Data>
                  <Data className="text-micro text-ink-soft">{t('now')}</Data>
                </View>
              </View>

              <Body className="text-body text-ink mt-3 leading-6">
                {trendSentence(trend.trend, trend.field, lang)}
              </Body>
              {rate ? (
                <Body className="text-body text-ink mt-1.5 leading-6">
                  {rate}
                </Body>
              ) : null}
              <Data className="text-micro text-ink-soft mt-3 leading-4">
                {t(
                  "Percentage of the sensor's full range, not a depth. Nobody has calibrated these nodes against a staff gauge, so this app will not put a number in centimetres on it.",
                )}
              </Data>
            </Section>
          </>
        ) : null}

        <Rule />

        <Section title={t('Take with you')}>
          {TAKE_WITH_YOU.map((item) => (
            <View key={item} className="flex-row mt-2">
              <View className="w-1.5 h-1.5 rounded-full bg-ink-soft mt-2 mr-3" />
              <Body className="text-body text-ink flex-1 leading-6">
                {t(item)}
              </Body>
            </View>
          ))}
          <Body className="text-meta text-ink-soft mt-3 leading-5">
            {t('Leave everything else. Things can be replaced.')}
          </Body>
        </Section>

        <Rule />

        <Section title={t('Why you are seeing this')}>
          {tiles.length > 0 ? (
            <View className="flex-row flex-wrap -mx-1 mb-3">
              {tiles.map((tile) => (
                <View key={tile.label} className="w-1/2 mb-2">
                  <SensorTile
                    icon={tile.icon}
                    label={tile.label}
                    value={tile.value}
                    unit={tile.unit}
                    status={tile.status}
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
              {t(
                'This warning was issued by the district authority rather than by a sensor reading.',
              )}
            </Body>
          )}

          <View className="mt-4 rounded-md bg-paper-deep p-3">
            <Data className="text-micro text-ink-soft leading-4">
              {t('Reported by {node}', { node: alert.node.name })}
            </Data>
            <Data className="text-micro text-ink-soft leading-4 mt-1">
              {t('{hazard} sensor, {kind} node, {status}', {
                hazard: hazardLabel(alert.hazard_type, lang),
                kind: alert.node.node_type,
                status: alert.node.status,
              })}
            </Data>
            <Data className="text-micro text-ink-soft leading-4 mt-1">
              {t('Recorded at {time}', { time: clockTime(alert.created_at) })}
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
  lang: Language,
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
        label: translate(lang, 'Water level'),
        value: String(reading.water_level),
        unit: '/4095',
        status: severity,
      });
    }
    if (reading.rain_level !== null) {
      tiles.push({
        icon: CloudRain,
        label: translate(lang, 'Rainfall'),
        value: String(reading.rain_level),
        unit: '/4095',
        status: 'ok',
      });
    }
    if (reading.humidity !== null) {
      tiles.push({
        icon: Droplets,
        label: translate(lang, 'Humidity'),
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
      label: translate(lang, 'Flame sensor'),
      value: reading.flame_detected
        ? translate(lang, 'Triggered')
        : translate(lang, 'Clear'),
      unit: '',
      status: reading.flame_detected ? severity : 'ok',
    });
  }
  if (reading.smoke_level !== null) {
    tiles.push({
      icon: Wind,
      label: translate(lang, 'Smoke'),
      value: String(reading.smoke_level),
      unit: '/4095',
      status: reading.flame_detected ? 'ok' : severity,
    });
  }
  if (reading.temperature !== null) {
    tiles.push({
      icon: Thermometer,
      label: translate(lang, 'Temperature'),
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
