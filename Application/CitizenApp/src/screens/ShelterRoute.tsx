import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ArrowUp,
  CheckCircle2,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  TriangleAlert,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Screen from '../components/ui/Screen';
import TopBar from '../components/ui/TopBar';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { occupancyLine, shelterReason } from '../domain/copy';
import { bearingDegrees, compassPoint, formatDistance, walkMinutes } from '../domain/geo';
import { colors } from '../theme/tokens';
import type {
  Hazard,
  Manoeuvre,
  RouteStep,
  ShelterWithRoute,
  UserPosition,
} from '../domain/types';

interface ShelterRouteProps {
  shelter: ShelterWithRoute;
  route: RouteStep[];
  hazard: Hazard;
  /** Where the walk starts. Used for the compass fallback when we have no steps. */
  position: UserPosition;
  /** Every shelter, so someone can reject the recommendation and pick their own. */
  shelters: ShelterWithRoute[];
  onBack: () => void;
  onSelectShelter: (shelter: ShelterWithRoute) => void;
}

const MANOEUVRE_ICON: Record<Manoeuvre, LucideIcon> = {
  start: ArrowUp,
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  arrive: Flag,
};

const STATUS_CHIP: Record<
  ShelterWithRoute['status'],
  { label: string; fill: string; text: string }
> = {
  open: { label: 'Open', fill: 'bg-olive', text: 'text-paper' },
  full: { label: 'Full', fill: 'bg-high', text: 'text-paper' },
  closed: { label: 'Closed', fill: 'bg-ink', text: 'text-paper' },
};

/**
 * Turn-by-turn walking guidance to a shelter.
 *
 * Built for one hand, in rain, at night, while frightened. That drives every
 * decision here: the current instruction is the largest type in the app after
 * the SOS screen, the manoeuvre arrow is a shape rather than a colour, and
 * advancing is a single wide button instead of a swipe.
 *
 * Position tracking is stubbed — steps advance on tap. The real version replaces
 * `advance` with a geofence crossing and nothing else about this screen changes.
 * Deliberately walking-first: telling a citizen to drive through a Kolkata flood
 * would be the worst advice this app could give.
 */
export default function ShelterRoute({
  shelter,
  route,
  hazard,
  position,
  shelters,
  onBack,
  onSelectShelter,
}: ShelterRouteProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [arrived, setArrived] = useState(false);

  const current = route[stepIndex];
  const upcoming = route.slice(stepIndex + 1);
  const hasSteps = route.length > 0;
  const remaining = route
    .slice(stepIndex)
    .reduce((sum, s) => sum + s.distance_metres, 0);
  const isLast = stepIndex === route.length - 1;
  const status = STATUS_CHIP[shelter.status];

  function advance() {
    if (isLast) {
      setArrived(true);
      return;
    }
    setStepIndex((i) => i + 1);
  }

  const alternatives = shelters.filter((s) => s.id !== shelter.id);

  if (arrived) {
    return (
      <Screen>
        <TopBar backLabel="Alert" onBack={onBack} />
        <View className="flex-1 px-6 justify-center items-start">
          <CheckCircle2 color={colors.olive} size={40} strokeWidth={2.5} />
          <Display className="text-headline text-ink mt-4">
            {`You have reached ${shelter.name}`}
          </Display>
          <Body className="text-body-lg text-ink mt-3 leading-7">
            Find a volunteer or an official at the entrance and give them your
            name so the district knows you are safe.
          </Body>
          <Data className="text-meta text-ink-soft mt-4">
            {shelter.address}
          </Data>
          <View className="mt-6 w-full">
            <Button
              label="Back to alerts"
              variant="secondary"
              onPress={onBack}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar backLabel="Alert" onBack={onBack} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Destination first: the reason to walk at all. */}
        <View className="px-4 pb-4">
          <Display className="text-headline text-ink">{shelter.name}</Display>
          {/*
            Only shown while we are counting steps down, where the number changes
            with every leg. Without steps the same distance is the headline of the
            direction card below, and printing it twice inside 150px would be
            noise rather than reassurance.
          */}
          {hasSteps ? (
            <Data className="text-body text-ink mt-1">
              {`${formatDistance(remaining)} left, about ${walkMinutes(remaining)} min on foot`}
            </Data>
          ) : null}
          <View className="flex-row items-center mt-3">
            <Chip label={status.label} fill={status.fill} text={status.text} />
            <Data className="text-micro text-ink-soft ml-2">
              {occupancyLine(shelter)}
            </Data>
          </View>
          <Body className="text-meta text-ink-soft mt-2 leading-5">
            {shelterReason(shelter, hazard, shelters[0]?.id === shelter.id)}
          </Body>
        </View>

        {shelter.routeCrossesRisk ? (
          <View className="mx-4 mb-4 flex-row bg-high-wash rounded-lg overflow-hidden">
            <View className="w-2 self-stretch bg-high" />
            <View className="flex-1 p-4">
              <Subhead className="text-body text-ink">
                This walk starts inside the flood zone
              </Subhead>
              <Body className="text-meta text-ink mt-1 leading-5">
                Go now rather than later, and turn back to higher ground if water
                reaches your knees.
              </Body>
            </View>
          </View>
        ) : null}

        {hasSteps ? (
          <>
            <CurrentStep step={current} index={stepIndex} total={route.length} />

            {upcoming.length > 0 ? (
              <View className="px-4 pt-5">
                <Subhead className="text-body text-ink mb-1">Then</Subhead>
                {upcoming.map((step, i) => (
                  <UpcomingStep key={`${step.instruction}-${i}`} step={step} />
                ))}
              </View>
            ) : null}

            <View className="px-4 pt-6">
              <Button
                label={isLast ? 'I have arrived' : 'Done, next step'}
                onPress={advance}
              />
            </View>
          </>
        ) : (
          <NoDirections
            shelter={shelter}
            position={position}
            onArrived={() => setArrived(true)}
          />
        )}

        <View className="h-px bg-paper-deep mx-4 mt-7" />

        <View className="px-4 pt-5">
          <Subhead className="text-body text-ink mb-1">Other shelters</Subhead>
          <Body className="text-meta text-ink-soft leading-5 mb-2">
            Pick a different one if this route looks wrong to you. You know your
            streets better than we do.
          </Body>
          {alternatives.map((alt) => (
            <AlternativeShelter
              key={alt.id}
              shelter={alt}
              onPress={() => onSelectShelter(alt)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * The instruction being walked right now. Given the whole width, a heavy
 * condensed face and a large arrow, because it has to be readable at a glance
 * from waist height without stopping.
 */
function CurrentStep({
  step,
  index,
  total,
}: {
  step: RouteStep;
  index: number;
  total: number;
}) {
  const Icon = MANOEUVRE_ICON[step.manoeuvre];
  return (
    <View className="bg-night mx-4 rounded-lg p-5">
      <Data className="text-micro text-paper">
        {`Step ${index + 1} of ${total}`}
      </Data>

      <View className="flex-row items-start mt-3">
        <Icon color={colors.brand} size={38} strokeWidth={2.5} />
        <View className="flex-1 ml-3">
          <Display className="text-headline text-paper leading-8">
            {step.instruction}
          </Display>
          <Data className="text-body-lg text-paper mt-2">
            {formatDistance(step.distance_metres)}
          </Data>
        </View>
      </View>

      {step.caution ? (
        <View className="flex-row items-start mt-4 bg-night-soft rounded-md p-3">
          <TriangleAlert color={colors.brand} size={17} strokeWidth={2.5} />
          <Body className="text-meta text-paper ml-2 flex-1 leading-5">
            {step.caution}
          </Body>
        </View>
      ) : null}
    </View>
  );
}

function UpcomingStep({ step }: { step: RouteStep }) {
  const Icon = MANOEUVRE_ICON[step.manoeuvre];
  return (
    <View className="flex-row items-start py-3 border-b border-paper-deep">
      <Icon color={colors.ink} size={19} strokeWidth={2.5} />
      <View className="flex-1 ml-3">
        <Body className="text-body text-ink leading-6">{step.instruction}</Body>
        <Data className="text-micro text-ink-soft mt-0.5">
          {formatDistance(step.distance_metres)}
        </Data>
        {step.caution ? (
          <View className="flex-row items-start mt-1.5">
            <TriangleAlert color={colors.high} size={13} strokeWidth={2.5} />
            <Data className="text-micro text-ink ml-1.5 flex-1 leading-4">
              {step.caution}
            </Data>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * What we show when we have no turn-by-turn data for the chosen shelter.
 *
 * Not an error state and deliberately not shaped like one. We still know four
 * useful things — which way, how far, how long, and the street address — so this
 * gives all four at the same visual weight the real directions get, on the same
 * night ground, with the same 38px mark. The one thing it will not do is imply
 * precision it does not have: the copy says "straight-line" out loud, because a
 * bearing across a Kolkata neighbourhood is a heading, not a path.
 */
function NoDirections({
  shelter,
  position,
  onArrived,
}: {
  shelter: ShelterWithRoute;
  position: UserPosition;
  onArrived: () => void;
}) {
  const heading = compassPoint(bearingDegrees(position, shelter));
  const distance = formatDistance(shelter.distanceMetres);

  return (
    <>
      {/*
        No container accessibilityLabel on purpose. Collapsing this card into one
        node would need a label that summarised it, and any summary short enough
        to be useful would drop the caution underneath — so the card is left to
        read in its natural order, which already says the right things in the
        right sequence.
      */}
      <View className="bg-night mx-4 rounded-lg p-5">
        <Data className="text-micro text-paper">Direction only</Data>

        <View className="flex-row items-start mt-3">
          <Compass color={colors.brand} size={38} strokeWidth={2.5} />
          <View className="flex-1 ml-3">
            <Display className="text-headline text-paper leading-8">
              {`Head ${heading}`}
            </Display>
            <Data className="text-body-lg text-paper mt-2">
              {`${distance}, about ${shelter.walkMinutes} min on foot`}
            </Data>
          </View>
        </View>

        <View className="flex-row items-start mt-4 bg-night-soft rounded-md p-3">
          <TriangleAlert color={colors.brand} size={17} strokeWidth={2.5} />
          <Body className="text-meta text-paper ml-2 flex-1 leading-5">
            That is the straight-line direction. Streets will not run that way,
            so keep to the main road that carries you {heading} and ask a police
            officer or a volunteer if you lose it.
          </Body>
        </View>
      </View>

      <View className="px-4 pt-5">
        <Subhead className="text-body text-ink">
          Walk to this address
        </Subhead>
        <Body className="text-body text-ink mt-1 leading-6">
          {shelter.address}
        </Body>
        <Body className="text-meta text-ink-soft mt-3 leading-5">
          We only have step-by-step directions for some shelters. Rather than
          show you another shelter's streets, we are giving you the direction and
          the address for this one.
        </Body>
      </View>

      <View className="px-4 pt-6">
        <Button label="I have arrived" onPress={onArrived} />
      </View>
    </>
  );
}

/**
 * A shelter the user could choose instead. A full or closed shelter is still
 * listed, greyed and labelled — hiding it would leave someone wondering whether
 * the hall they know about is an option.
 */
function AlternativeShelter({
  shelter,
  onPress,
}: {
  shelter: ShelterWithRoute;
  onPress: () => void;
}) {
  const status = STATUS_CHIP[shelter.status];
  const unavailable = shelter.status !== 'open';

  return (
    <Pressable
      onPress={onPress}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable }}
      accessibilityLabel={`${shelter.name}, ${formatDistance(shelter.distanceMetres)} away, ${status.label}`}
    >
      {({ pressed }) => (
        <View
          className={`flex-row items-center py-3 border-b border-paper-deep ${
            pressed ? 'bg-paper-deep' : ''
          } ${unavailable ? 'opacity-50' : ''}`}
        >
          <View className="flex-1 pr-3">
            <Subhead className="text-body text-ink">{shelter.name}</Subhead>
            <Data className="text-micro text-ink-soft mt-0.5">
              {`${formatDistance(shelter.distanceMetres)}, ${shelter.walkMinutes} min walk`}
            </Data>
          </View>
          <Chip label={status.label} fill={status.fill} text={status.text} />
        </View>
      )}
    </Pressable>
  );
}
