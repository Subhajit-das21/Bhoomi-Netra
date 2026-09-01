import React from 'react';
import { ScrollView, View } from 'react-native';
import { Droplets, Flame, Map, Navigation } from 'lucide-react-native';
import Screen from '../components/ui/Screen';
import TopBar from '../components/ui/TopBar';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { SEVERITY, directive, HAZARD_LABEL } from '../domain/severity';
import { evidence, headline, proximity } from '../domain/copy';
import { clockTime, formatDistance, timeAgo, walkMinutes } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { AlertWithContext, ShelterWithRoute } from '../domain/types';

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
