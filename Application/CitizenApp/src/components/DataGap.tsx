import React from 'react';
import { View } from 'react-native';
import { CloudOff, RadioTower, ServerCrash, Unplug } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Button from './ui/Button';
import { Body, Data, Display } from './ui/Type';
import { colors } from '../theme/tokens';
import { t as translate } from '../domain/i18n';
import { useText } from '../state/useText';
import type { Language, LoadFailure, LoadState } from '../domain/types';

interface DataGapProps {
  state: Exclude<LoadState, 'ready'>;
  failure: LoadFailure | null;
  locality: string;
  onRetry: () => void;
  isRefreshing: boolean;
}

/**
 * What the app says when it has no data at all.
 *
 * This is the most dangerous screen in the product, and it is dangerous in a way
 * that is easy to miss. An alert feed with nothing in it looks exactly like an
 * alert feed with nothing to report — so if a failed fetch is allowed to fall
 * through to the empty state, the app tells a person standing in a flood zone
 * that nothing is affecting their area. Every branch below exists to make sure an
 * absence of data never reads as an absence of danger. The words "this is not an
 * all-clear" appear on every failure for that reason.
 *
 * ------------------------------------------------------------------
 * Why it does not look like an error
 * ------------------------------------------------------------------
 * No severity colour, and deliberately so. The ramp from indigo to red oxide
 * means "how bad is the hazard", and a network fault is not a hazard — painting
 * this screen in critical red would spend the loudest signal the design has on
 * the app's own plumbing, and the next real warning would land on a reader who
 * had already been shouted at once. It sits on `paper-deep` instead: the recessed
 * ground the theme reserves for surfaces where the app is talking about itself
 * rather than about the district, with a single ochre rule down the side to mark
 * that something needs attention.
 *
 * The first-load case gets no spinner. A spinner says "wait" and says nothing
 * else; the copy here says what the app is doing, and — more usefully — what it
 * will do if that does not work. Someone who reads this once knows the app will
 * not leave them staring at it.
 *
 * ------------------------------------------------------------------
 * Translated, unlike the rest of the app's own plumbing
 * ------------------------------------------------------------------
 * Settings stays in English because a settings screen read in the wrong language
 * costs a moment. This one is different: "this is not an all-clear" is the whole
 * point of the card, and an English sentence saying so, shown to a Bengali reader
 * looking at an empty feed, is indistinguishable from an empty feed. So the four
 * branches are translated — including the build-fault one, whose environment
 * variable names stay Latin because they are identifiers and not words.
 */
export default function DataGap({
  state,
  failure,
  locality,
  onRetry,
  isRefreshing,
}: DataGapProps) {
  const { lang, t } = useText();
  const { icon: Icon, rule, title, body, note, canRetry } =
    state === 'first-load'
      ? firstLoad(locality, lang)
      : failed(failure, locality, lang);

  return (
    <View className="mx-4 mb-3 rounded-lg bg-paper-deep overflow-hidden flex-row">
      {/*
        A 6px rule rather than a tinted card or a full field. In the severity
        system that weight means "notice this", which is the honest register for a
        problem the app has with itself. Ochre, not terracotta: nothing here is
        about the water.
      */}
      <View className={`w-1.5 self-stretch ${rule}`} />

      <View className="flex-1 p-5 items-start">
        <Icon color={colors.ink} size={22} strokeWidth={2.5} />

        <Display className="text-title text-ink mt-3">{title}</Display>

        <Body className="text-body text-ink mt-2 leading-6">{body}</Body>

        {note ? (
          <Data className="text-micro text-ink-soft mt-3 leading-4">{note}</Data>
        ) : null}

        {canRetry ? (
          <View className="pt-4 self-stretch">
            <Button
              label={isRefreshing ? t('Checking…') : t('Try again')}
              variant="secondary"
              onPress={onRetry}
              disabled={isRefreshing}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

interface Content {
  icon: LucideIcon;
  rule: string;
  title: string;
  body: string;
  note?: string;
  canRetry: boolean;
}

function firstLoad(locality: string, lang: Language): Content {
  return {
    icon: RadioTower,
    // Olive, not ochre. A first load is the app working, not the app failing, and
    // it should not put a mark of concern on screen before there is anything wrong.
    rule: 'bg-olive',
    title: translate(lang, 'Checking for alerts'),
    body: translate(
      lang,
      'Reading the district sensor network for {locality}. This usually takes a moment on a normal connection and longer on a weak one.',
      { locality },
    ),
    note: translate(
      lang,
      'If it does not load, this screen will say so plainly rather than keep spinning.',
    ),
    canRetry: false,
  };
}

function failed(
  failure: LoadFailure | null,
  locality: string,
  lang: Language,
): Content {
  switch (failure) {
    /**
     * The common case, and the one whose wording matters most. A citizen can act
     * on this: move, wait, try again. What they must not do is read it as safety,
     * so the second sentence says so before anything else can be inferred.
     */
    case 'unreachable':
      return {
        icon: CloudOff,
        rule: 'bg-medium',
        title: translate(lang, 'We could not check for alerts'),
        body: translate(
          lang,
          'There is no usable connection, so nothing on this screen is current. This is not an all-clear — a warning could be active for {locality} and this phone would not know.',
          { locality },
        ),
        note: translate(
          lang,
          'For anything happening right now, call 112. Move to higher ground and away from water without waiting for this app.',
        ),
        canRetry: true,
      };

    /**
     * A build fault, not a user problem, and the copy has to make that separation
     * clean: retrying will never fix it, so there is no retry button to imply
     * otherwise. The instruction is aimed at whoever installed this build.
     */
    case 'unconfigured':
      return {
        icon: Unplug,
        rule: 'bg-medium',
        title: translate(lang, 'This build has no data source'),
        body: translate(
          lang,
          'The app was compiled without the district database address, so it cannot receive alerts at all. This is not an all-clear and it will not fix itself.',
        ),
        note: translate(
          lang,
          'Whoever installed this build needs to set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY and rebuild. Do not rely on this phone for warnings until then.',
        ),
        canRetry: false,
      };

    case 'server':
      return {
        icon: ServerCrash,
        rule: 'bg-medium',
        title: translate(lang, 'The alert service refused'),
        body: translate(
          lang,
          'We reached the district system and it would not answer. This is not an all-clear — assume nothing about conditions in {locality}.',
          { locality },
        ),
        note: translate(
          lang,
          'This is a fault at our end, not on your phone. Trying again may work, but call 112 for anything urgent rather than waiting.',
        ),
        canRetry: true,
      };

    /**
     * `failed` without a recorded reason should not happen — `load` always sets
     * one before it sets the state. Handled anyway, because the alternative to a
     * vague warning here is a blank screen, and on this screen a blank is the one
     * outcome that could be read as safety.
     */
    default:
      return {
        icon: CloudOff,
        rule: 'bg-medium',
        title: translate(lang, 'No alert data'),
        body: translate(
          lang,
          'Nothing loaded, and we cannot tell you why. This is not an all-clear — assume nothing about conditions in {locality}.',
          { locality },
        ),
        note: translate(lang, 'For anything happening right now, call 112.'),
        canRetry: true,
      };
  }
}
