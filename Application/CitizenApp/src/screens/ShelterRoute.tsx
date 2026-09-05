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
import { occupancyLine, routeSource, shelterReason } from '../domain/copy';
import { bearingDegrees, compassPoint, formatDistance, walkMinutes } from '../domain/geo';
import { useWalkingDirections } from '../state/useWalkingDirections';
import { useHousehold } from '../state/HouseholdProvider';
import { useText } from '../state/useText';
import { colors } from '../theme/tokens';
import type { WalkingDirections } from '../state/useWalkingDirections';
import type {
  Hazard,
  Manoeuvre,
  RouteStep,
  ShelterWithRoute,
  UserPosition,
} from '../domain/types';

interface ShelterRouteProps {
  shelter: ShelterWithRoute;
  /** The surveyed steps for this shelter, or an empty array. */
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

/**
 * The three states a hall can be in, and the ground each one gets.
 *
 * `label` is an English dictionary key rather than finished text: this is a
 * module constant, so it is built once before any household has said which
 * language it reads, and the translation has to happen at the point of render.
 */
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
 *
 * ------------------------------------------------------------------
 * Two sources of directions, one layout
 * ------------------------------------------------------------------
 * The surveyed rows in `shelter_routes` come first and a router fills in behind
 * them, which state/useWalkingDirections.ts argues at length. Both arrive as the
 * same `RouteStep[]` and render through the same components on purpose — the
 * alternative is two step lists to keep in step with each other, and the second one
 * would be the one that rots.
 *
 * What does differ is a sentence. `routeSource` says whether a person walked this
 * street or a machine read a map, because those are not equally trustworthy at a
 * junction and the reader is the one taking the risk.
 *
 * ------------------------------------------------------------------
 * The one screen whose text is only half translatable
 * ------------------------------------------------------------------
 * Every word this file writes goes through `t`. The step instructions do not,
 * because this file does not write them: a surveyed step is a row typed by a ward
 * officer and a generated one is a sentence composed by OpenRouteService, and both
 * name a street. So a Bengali reader gets Bengali chrome around an English turn.
 *
 * That is the honest state rather than the finished one. The fix is two writes,
 * not a dictionary — a Bengali column on `shelter_routes`, and ORS's `language`
 * parameter, which has Hindi but at the time of writing no Bengali. Translating
 * street names on the device is the one thing that must not happen: the reader is
 * matching what the phone says against the board at the junction.
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
  const { lang, t } = useText();
  const { household } = useHousehold();
  const [stepIndex, setStepIndex] = useState(0);
  const [arrived, setArrived] = useState(false);

  const directions = useWalkingDirections(shelter, route);
  const steps = directions.steps;

  /**
   * Clamped, not trusted. Generated steps can be replaced mid-walk when the
   * district publishes a new zone and the route is recomputed around it, and a
   * shorter second answer would otherwise leave this index off the end of the
   * array — which is a blank white screen at the exact moment somebody is looking
   * at their phone for the next turn.
   */
  const index = Math.min(stepIndex, Math.max(steps.length - 1, 0));

  const current = steps[index];
  const upcoming = steps.slice(index + 1);
  const hasSteps = steps.length > 0;
  const remaining = steps
    .slice(index)
    .reduce((sum, s) => sum + s.distance_metres, 0);
  const isLast = index === steps.length - 1;
  const status = STATUS_CHIP[shelter.status];

  function advance() {
    if (isLast) {
      setArrived(true);
      return;
    }
    setStepIndex(index + 1);
  }

  const alternatives = shelters.filter((s) => s.id !== shelter.id);

  if (arrived) {
    return (
      <Screen>
        <TopBar backLabel={t('Alert')} onBack={onBack} />
        <View className="flex-1 px-6 justify-center items-start">
          <CheckCircle2 color={colors.olive} size={40} strokeWidth={2.5} />
          <Display className="text-headline text-ink mt-4">
            {t('You have reached {shelter}', { shelter: shelter.name })}
          </Display>
          <Body className="text-body-lg text-ink mt-3 leading-7">
            {t(
              'Find a volunteer or an official at the entrance and give them your name so the district knows you are safe.',
            )}
          </Body>
          <Data className="text-meta text-ink-soft mt-4">
            {shelter.address}
          </Data>
          <View className="mt-6 w-full">
            <Button
              label={t('Back to alerts')}
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
      <TopBar backLabel={t('Alert')} onBack={onBack} />

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
              {t('{distance} left, about {minutes} min on foot', {
                distance: formatDistance(remaining, lang),
                minutes: walkMinutes(remaining),
              })}
            </Data>
          ) : null}
          <View className="flex-row items-center mt-3">
            <Chip
              label={t(status.label)}
              fill={status.fill}
              text={status.text}
            />
            <Data className="text-micro text-ink-soft ml-2">
              {occupancyLine(shelter, lang)}
            </Data>
          </View>
          <Body className="text-meta text-ink-soft mt-2 leading-5">
            {/* The household size, so the reason line can say whether everybody
                fits rather than assuming one person walked here alone. */}
            {shelterReason(
              shelter,
              hazard,
              shelters[0]?.id === shelter.id,
              household?.profile.people ?? 1,
              lang,
            )}
          </Body>
        </View>

        {shelter.routeCrossesRisk ? (
          <View className="mx-4 mb-4 flex-row bg-high-wash rounded-lg overflow-hidden">
            <View className="w-2 self-stretch bg-high" />
            <View className="flex-1 p-4">
              <Subhead className="text-body text-ink">
                {t('This walk starts inside the flood zone')}
              </Subhead>
              <Body className="text-meta text-ink mt-1 leading-5">
                {t(
                  'Go now rather than later, and turn back to higher ground if water reaches your knees.',
                )}
              </Body>
            </View>
          </View>
        ) : null}

        {hasSteps ? (
          <>
            <CurrentStep step={current} index={index} total={steps.length} />

            {directions.source ? (
              /* Under the card rather than inside it. This sentence decides how
                 much to trust the instruction above, so it has to be next to it —
                 but it is not the instruction, and 118 characters of provenance
                 inside the one card that has to be read at arm's length would make
                 it compete with the turn. */
              <Data className="text-micro text-ink-soft mx-4 mt-2 leading-4">
                {routeSource(directions.source, lang)}
              </Data>
            ) : null}

            {upcoming.length > 0 ? (
              <View className="px-4 pt-5">
                <Subhead className="text-body text-ink mb-1">
                  {t('Then')}
                </Subhead>
                {upcoming.map((step, i) => (
                  <UpcomingStep key={`${step.instruction}-${i}`} step={step} />
                ))}
              </View>
            ) : null}

            <View className="px-4 pt-6">
              <Button
                label={isLast ? t('I have arrived') : t('Done, next step')}
                onPress={advance}
              />
            </View>
          </>
        ) : (
          <NoDirections
            shelter={shelter}
            position={position}
            gap={directions.gap}
            onArrived={() => setArrived(true)}
          />
        )}

        <View className="h-px bg-paper-deep mx-4 mt-7" />

        <View className="px-4 pt-5">
          <Subhead className="text-body text-ink mb-1">
            {t('Other shelters')}
          </Subhead>
          <Body className="text-meta text-ink-soft leading-5 mb-2">
            {t(
              'Pick a different one if this route looks wrong to you. You know your streets better than we do.',
            )}
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
  const { lang, t } = useText();
  const Icon = MANOEUVRE_ICON[step.manoeuvre];
  return (
    <View className="bg-night mx-4 rounded-lg p-5">
      <Data className="text-micro text-paper">
        {t('Step {n} of {total}', { n: index + 1, total })}
      </Data>

      <View className="flex-row items-start mt-3">
        <Icon color={colors.brand} size={38} strokeWidth={2.5} />
        <View className="flex-1 ml-3">
          <Display className="text-headline text-paper leading-8">
            {step.instruction}
          </Display>
          <Data className="text-body-lg text-paper mt-2">
            {formatDistance(step.distance_metres, lang)}
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
  const { lang } = useText();
  const Icon = MANOEUVRE_ICON[step.manoeuvre];
  return (
    <View className="flex-row items-start py-3 border-b border-paper-deep">
      <Icon color={colors.ink} size={19} strokeWidth={2.5} />
      <View className="flex-1 ml-3">
        <Body className="text-body text-ink leading-6">{step.instruction}</Body>
        <Data className="text-micro text-ink-soft mt-0.5">
          {formatDistance(step.distance_metres, lang)}
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
 *
 * This is also what stands in for a loading state while the router is being asked,
 * and there is deliberately no spinner over it. Four true facts now beat a fifth in
 * six seconds when somebody is standing in water. If steps arrive they replace this
 * card; if they do not, nothing was taken away to wait for them.
 */
function NoDirections({
  shelter,
  position,
  gap,
  onArrived,
}: {
  shelter: ShelterWithRoute;
  position: UserPosition;
  gap: WalkingDirections['gap'];
  onArrived: () => void;
}) {
  const { lang, t } = useText();
  const heading = t(compassPoint(bearingDegrees(position, shelter)));
  const distance = formatDistance(shelter.distanceMetres, lang);

  return (
    <>
      {/*
        The router looked and found no way round the water. That is not a technical
        failure to log quietly — it is the single most useful thing this screen can
        say, and it changes the instruction from "walk" to "do not walk". Same
        banner shape as the crosses-risk warning above it, because it is the same
        kind of statement.
      */}
      {gap === 'no-path' ? (
        <View className="mx-4 mb-4 flex-row bg-high-wash rounded-lg overflow-hidden">
          <View className="w-2 self-stretch bg-critical" />
          <View className="flex-1 p-4">
            <Subhead className="text-body text-ink">
              {t('No walking route avoids the water')}
            </Subhead>
            <Body className="text-meta text-ink mt-1 leading-5">
              {t(
                'Every way out of here crosses a marked zone. Do not wade to follow the direction below. Call 112 and ask for a boat, and move to the highest floor you can reach while you wait.',
              )}
            </Body>
          </View>
        </View>
      ) : null}

      {/*
        No container accessibilityLabel on purpose. Collapsing this card into one
        node would need a label that summarised it, and any summary short enough
        to be useful would drop the caution underneath — so the card is left to
        read in its natural order, which already says the right things in the
        right sequence.
      */}
      <View className="bg-night mx-4 rounded-lg p-5">
        <Data className="text-micro text-paper">{t('Direction only')}</Data>

        <View className="flex-row items-start mt-3">
          <Compass color={colors.brand} size={38} strokeWidth={2.5} />
          <View className="flex-1 ml-3">
            <Display className="text-headline text-paper leading-8">
              {t('Head {heading}', { heading })}
            </Display>
            <Data className="text-body-lg text-paper mt-2">
              {t('{distance}, about {minutes} min on foot', {
                distance,
                minutes: shelter.walkMinutes,
              })}
            </Data>
          </View>
        </View>

        <View className="flex-row items-start mt-4 bg-night-soft rounded-md p-3">
          <TriangleAlert color={colors.brand} size={17} strokeWidth={2.5} />
          <Body className="text-meta text-paper ml-2 flex-1 leading-5">
            {t(
              'That is the straight-line direction. Streets will not run that way, so keep to the main road that carries you {heading} and ask a police officer or a volunteer if you lose it.',
              { heading },
            )}
          </Body>
        </View>
      </View>

      <View className="px-4 pt-5">
        <Subhead className="text-body text-ink">
          {t('Walk to this address')}
        </Subhead>
        <Body className="text-body text-ink mt-1 leading-6">
          {shelter.address}
        </Body>
        <Body className="text-meta text-ink-soft mt-3 leading-5">
          {gap === 'asking'
            ? t(
                'Nobody has surveyed the walk to this shelter. We are asking a street map for one now — the direction above holds either way.',
              )
            : t(
                "We only have step-by-step directions for some shelters. Rather than show you another shelter's streets, we are giving you the direction and the address for this one.",
              )}
        </Body>
      </View>

      <View className="px-4 pt-6">
        <Button label={t('I have arrived')} onPress={onArrived} />
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
  const { lang, t } = useText();
  const status = STATUS_CHIP[shelter.status];
  const unavailable = shelter.status !== 'open';
  const label = t(status.label);
  const away = formatDistance(shelter.distanceMetres, lang);

  return (
    <Pressable
      onPress={onPress}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable }}
      accessibilityLabel={t('{shelter}, {distance} away, {status}', {
        shelter: shelter.name,
        distance: away,
        status: label,
      })}
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
              {t('{distance}, {minutes} min walk', {
                distance: away,
                minutes: shelter.walkMinutes,
              })}
            </Data>
          </View>
          <Chip label={label} fill={status.fill} text={status.text} />
        </View>
      )}
    </Pressable>
  );
}
