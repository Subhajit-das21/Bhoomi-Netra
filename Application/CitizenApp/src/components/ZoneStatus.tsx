import React from 'react';
import { Pressable, View } from 'react-native';
import { MapPin, ShieldCheck } from 'lucide-react-native';
import { Body, Data, Display } from './ui/Type';
import { SEVERITY, HAZARD_LABEL } from '../domain/severity';
import { formatDistance } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { RiskZone, UserPosition } from '../domain/types';

interface ZoneStatusProps {
  zone: RiskZone | null;
  nearestMetres: number;
  position: UserPosition;
  onPress: () => void;
}

/**
 * Answers one question: am I in a marked risk zone right now?
 *
 * Deliberately a statement of fact rather than a map. The dense zone geometry
 * belongs to the authority dashboard; here the citizen needs a yes or a no, the
 * name of the zone, and a way through to the map if they want to see it.
 *
 * GPS accuracy is shown rather than hidden — an 18 m fix near a zone edge is a
 * different situation from a 200 m fix, and pretending otherwise is how people
 * end up trusting a boundary that was never that precise.
 */
export default function ZoneStatus({
  zone,
  nearestMetres,
  position,
  onPress,
}: ZoneStatusProps) {
  const inside = zone !== null;
  const s = zone ? SEVERITY[zone.severity] : null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        inside
          ? `You are inside ${zone!.name}, a ${zone!.severity} ${zone!.hazard} zone`
          : `You are outside all risk zones. Nearest is ${formatDistance(nearestMetres)} away`
      }
      accessibilityHint="Opens the zone map"
    >
      {({ pressed }) => (
        <View
          className={`mx-4 mb-3 rounded-lg overflow-hidden flex-row ${
            inside ? s!.card : 'bg-paper-deep'
          } ${pressed ? 'opacity-80' : ''}`}
        >
          <View
            className={`w-2 self-stretch ${inside ? s!.ruleColor : 'bg-olive'}`}
          />

          <View className="flex-1 p-4">
            <View className="flex-row items-center mb-1.5">
              {inside ? (
                <MapPin color={s!.accent} size={15} strokeWidth={2.5} />
              ) : (
                <ShieldCheck color={colors.olive} size={15} strokeWidth={2.5} />
              )}
              <Data
                className={`text-micro ml-1.5 ${inside ? s!.meta : 'text-ink-soft'}`}
              >
                {inside ? zone!.name : 'Your location'}
              </Data>
            </View>

            <Display
              className={`text-title ${inside ? s!.title : 'text-ink'}`}
            >
              {inside
                ? `You are inside a ${HAZARD_LABEL[zone!.hazard].toLowerCase()} zone`
                : 'You are outside all risk zones'}
            </Display>

            <Body
              className={`text-meta mt-1 leading-5 ${inside ? s!.body : 'text-ink-soft'}`}
            >
              {inside
                ? `Marked ${zone!.severity} by the district authority.`
                : `Nearest marked zone is ${formatDistance(nearestMetres)} away.`}
            </Body>

            <Data
              className={`text-micro mt-2 ${inside ? s!.meta : 'text-ink-soft'}`}
            >
              {`Location accurate to ${position.accuracyMetres} m`}
            </Data>
          </View>
        </View>
      )}
    </Pressable>
  );
}
