import React from 'react';
import { View } from 'react-native';
import { AlertTriangle, Droplets, Flame } from 'lucide-react-native';
import { Body, Display, Subhead } from './ui/Type';
import { SEVERITY } from '../domain/severity';
import { colors } from '../theme/tokens';
import type { Hazard, Severity } from '../domain/types';

interface AlertBannerProps {
  severity?: Severity;
  hazard?: Hazard;
  title: string;
  message: string;
}

/**
 * The single most urgent alert, shown at the top of the feed.
 *
 * Severity drives ground, rule weight and chip inversion through the shared
 * SEVERITY map rather than a local colour switch, so a card here and a row in
 * the feed can never disagree about what "high" looks like.
 */
export default function AlertBanner({
  severity = 'medium',
  hazard = 'flood',
  title,
  message,
}: AlertBannerProps) {
  const s = SEVERITY[severity];
  const HazardIcon = hazard === 'fire' ? Flame : Droplets;

  return (
    <View className={`mx-4 my-3 rounded-lg overflow-hidden flex-row ${s.card}`}>
      {s.rule ? <View className={`${s.rule} self-stretch ${s.ruleColor}`} /> : null}

      <View className="flex-1 p-4">
        <View className="flex-row items-center mb-2">
          <View className={`flex-row items-center px-2 py-1 rounded-sm ${s.chip}`}>
            <AlertTriangle
              color={severity === 'critical' ? s.accent : colors.paper}
              size={13}
              strokeWidth={3}
            />
            <Subhead className={`text-micro ml-1.5 ${s.chipText}`}>
              {s.label.toUpperCase()}
            </Subhead>
          </View>
          <View className="flex-row items-center ml-2">
            <HazardIcon color={s.accent} size={15} strokeWidth={2.5} />
          </View>
        </View>

        <Display className={`text-title ${s.title}`}>{title}</Display>
        <Body className={`text-body mt-1.5 leading-6 ${s.body}`}>{message}</Body>
      </View>
    </View>
  );
}
