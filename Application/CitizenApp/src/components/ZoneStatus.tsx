import React from 'react';
import { Pressable, View } from 'react-native';
import { MapPin, MapPinOff, ShieldCheck } from 'lucide-react-native';
import { Body, Data, Display } from './ui/Type';
import { SEVERITY, hazardLabel } from '../domain/severity';
import { formatDistance } from '../domain/geo';
import { useText } from '../state/useText';
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
 *
 * The zone's own name is never translated. It is a label the district authority
 * typed, and it is what a reader will hear on the radio and see on a notice
 * board; a translated version of it would be a name nobody else is using.
 */
export default function ZoneStatus({
  zone,
  nearestMetres,
  position,
  onPress,
}: ZoneStatusProps) {
  const { lang, t } = useText();
  const inside = zone !== null;
  const s = zone ? SEVERITY[zone.severity] : null;
  /**
   * `toLowerCase` on a translated word looks like the sort of English-shaped
   * assumption that breaks in Bengali, and here it is not one: neither Bengali nor
   * Devanagari has letter case, so it returns the string untouched and only does
   * work in English, where 'Flooding' has to become 'flooding' mid-sentence.
   */
  const hazardWord = zone
    ? hazardLabel(zone.hazard_type, lang).toLowerCase()
    : '';

  /**
   * Whether there is a nearest zone to measure to at all.
   *
   * The provider hands back Infinity when the district has published no zones,
   * which is a real state — a district that has not finished its survey — and not
   * an error. Formatting it would print "Infinity km away", and the outside-a-zone
   * copy would otherwise imply someone had checked and found nothing nearby.
   */
  const hasNearest = Number.isFinite(nearestMetres);
  const nowhereMapped = t(
    'No hazard zones have been mapped for this district yet, so there is nothing here to be outside of.',
  );
  const outsideDetail = hasNearest
    ? t('Nearest marked zone is {distance} away.', {
        distance: formatDistance(nearestMetres, lang),
      })
    : nowhereMapped;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        inside
          ? t('You are inside {zone}, a {severity} {hazard} zone', {
              zone: zone!.name,
              // The bare lowercase adjective, not `severityLabel`: this one sits
              // inside a sentence and the dictionaries carry it separately for
              // exactly that reason.
              severity: t(zone!.severity),
              hazard: hazardWord,
            })
          : hasNearest
            ? t('You are outside all risk zones. Nearest is {distance} away', {
                distance: formatDistance(nearestMetres, lang),
              })
            : t('No hazard zones have been mapped for this district yet')
      }
      accessibilityHint={t('Opens the zone map')}
    >
      {({ pressed }) => (
        <View
          className={`mx-4 mb-3 rounded-lg overflow-hidden flex-row ${
            inside ? s!.card : 'bg-paper-deep'
          } ${pressed ? 'opacity-80' : ''}`}
        >
          {/*
            Olive is the all-clear rule and it is only earned when we have zones to
            compare against. With none published, an olive rule and a shield would
            read as "checked, you are fine" — so that case gets the ochre notice
            weight and a struck-through pin instead.
          */}
          <View
            className={`w-2 self-stretch ${
              inside ? s!.ruleColor : hasNearest ? 'bg-olive' : 'bg-medium'
            }`}
          />

          <View className="flex-1 p-4">
            <View className="flex-row items-center mb-1.5">
              {inside ? (
                <MapPin color={s!.accent} size={15} strokeWidth={2.5} />
              ) : hasNearest ? (
                <ShieldCheck color={colors.olive} size={15} strokeWidth={2.5} />
              ) : (
                <MapPinOff color={colors['ink-soft']} size={15} strokeWidth={2.5} />
              )}
              <Data
                className={`text-micro ml-1.5 ${inside ? s!.meta : 'text-ink-soft'}`}
              >
                {inside ? zone!.name : t('Your location')}
              </Data>
            </View>

            <Display
              className={`text-title ${inside ? s!.title : 'text-ink'}`}
            >
              {inside
                ? t('You are inside a {hazard} zone', { hazard: hazardWord })
                : hasNearest
                  ? t('You are outside all risk zones')
                  : t('No zones mapped here')}
            </Display>

            <Body
              className={`text-meta mt-1 leading-5 ${inside ? s!.body : 'text-ink-soft'}`}
            >
              {inside
                ? t('Marked {severity} by the district authority.', {
                    severity: t(zone!.severity),
                  })
                : outsideDetail}
            </Body>

            <Data
              className={`text-micro mt-2 ${inside ? s!.meta : 'text-ink-soft'}`}
            >
              {t('Location accurate to {n} m', {
                n: position.accuracyMetres,
              })}
            </Data>
          </View>
        </View>
      )}
    </Pressable>
  );
}
