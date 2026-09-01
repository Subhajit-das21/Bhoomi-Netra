import React from 'react';
import { Pressable, View } from 'react-native';
import { Droplets, Flame } from 'lucide-react-native';
import { Body, Data, Display } from './ui/Type';
import Chip from './ui/Chip';
import { SEVERITY, stance } from '../domain/severity';
import { headline, proximity } from '../domain/copy';
import { timeAgo } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { AlertWithContext } from '../domain/types';

interface AlertCardProps {
  alert: AlertWithContext;
  /** The top card in the feed gets more room and a larger headline. */
  prominent?: boolean;
  onPress: () => void;
}

/**
 * One alert in the feed.
 *
 * Replaces the previous AlertBanner, which duplicated this job with its own
 * colour switch. One component means a card and a row can never disagree about
 * what a severity looks like.
 *
 * The escalation from low to critical is carried by how much of the card the
 * colour occupies — hairline rule, thicker rule, tinted ground, then the whole
 * card as a field — so it survives greyscale, colourblindness and sunlight.
 */
export default function AlertCard({ alert, prominent, onPress }: AlertCardProps) {
  const s = SEVERITY[alert.severity];
  const HazardIcon = alert.hazard_type === 'fire' ? Flame : Droplets;
  const isCritical = alert.severity === 'critical';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${s.label}. ${headline(alert)}. ${proximity(alert)}.`}
      accessibilityHint="Opens what to do about this alert"
    >
      {({ pressed }) => (
        <View
          className={`mx-4 mb-3 rounded-lg overflow-hidden flex-row ${s.card} ${
            pressed ? 'opacity-80' : ''
          }`}
        >
          {s.rule ? (
            <View className={`${s.rule} self-stretch ${s.ruleColor}`} />
          ) : null}

          <View className={`flex-1 ${prominent ? 'p-4' : 'px-4 py-3'}`}>
            <View className="flex-row items-center mb-2">
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

            <Display
              className={`${prominent ? 'text-headline' : 'text-title'} ${s.title}`}
            >
              {headline(alert)}
            </Display>

            <View className="flex-row items-center mt-1.5">
              <Data className={`text-meta ${s.meta}`}>{proximity(alert)}</Data>
            </View>

            {prominent ? (
              <Body className={`text-body-lg mt-3 leading-7 ${s.body}`}>
                {stance(alert.severity)}. Tap for directions and what to take.
              </Body>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}
