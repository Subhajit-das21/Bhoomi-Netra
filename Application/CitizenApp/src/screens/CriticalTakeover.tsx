import React from 'react';
import { View } from 'react-native';
import { Navigation, TriangleAlert } from 'lucide-react-native';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../components/ui/Button';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { directive } from '../domain/severity';
import { headline, spokenSeverity } from '../domain/copy';
import { formatDistance, timeAgo } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { AlertWithContext, ShelterWithRoute } from '../domain/types';

interface CriticalTakeoverProps {
  alert: AlertWithContext;
  shelter: ShelterWithRoute | null;
  zoneName: string;
  onRoute: () => void;
  onAcknowledge: () => void;
}

/**
 * What a critical escalation looks like.
 *
 * This is the only screen in the app that takes over. It is reached without being
 * asked for, so it earns that by being unambiguous: a full field of red oxide, one
 * instruction, and the two things a person can do about it. There is no tab bar,
 * no back gesture and nothing to scroll, because a screen that can be dismissed
 * by accident is not an alarm.
 *
 * The order of the two buttons is deliberate. "Show me the way" is the primary,
 * and acknowledging is the quiet one below it — the aim is to move someone, not
 * to collect a dismissal. Acknowledging stops the vibration; it does not mark the
 * hazard as handled, and the copy says so.
 *
 * Screen readers get `spokenSeverity` first via the container label, so the
 * severity is heard before the headline rather than after it.
 *
 * Contrast note: cream at 80% over red oxide lands at exactly 4.5:1, which passes
 * AA with no margin at all. The two small lines here run at 90% (5.27:1) instead,
 * because "exactly at the limit" is not a standard worth holding on the one
 * screen someone reads in a panic.
 */
export default function CriticalTakeover({
  alert,
  shelter,
  zoneName,
  onRoute,
  onAcknowledge,
}: CriticalTakeoverProps) {
  return (
    <SafeAreaView className="flex-1 bg-critical">
      <StatusBar barStyle="light-content" backgroundColor={colors.critical} />

      <View
        className="flex-1 px-6 justify-center"
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={`${spokenSeverity(alert.severity, alert.hazard_type)} ${headline(alert)}. ${directive(alert.hazard_type, alert.severity)}`}
      >
        <TriangleAlert color={colors.paper} size={46} strokeWidth={2.5} />

        <Display className="text-siren text-paper mt-4">LEAVE NOW</Display>

        <Display className="text-headline text-paper mt-3 leading-8">
          {headline(alert)}
        </Display>

        <Body className="text-body-lg text-paper mt-4 leading-7">
          {directive(alert.hazard_type, alert.severity)}
        </Body>

        <View className="mt-5 border-t border-paper pt-4">
          <Data className="text-meta text-paper">{zoneName}</Data>
          <Data className="text-micro text-paper opacity-90 mt-1">
            {`Issued ${timeAgo(alert.created_at)}`}
          </Data>
        </View>
      </View>

      <View className="px-6 pb-8">
        {shelter ? (
          <>
            <Button
              label={`Walk to ${shelter.name}`}
              icon={Navigation}
              variant="secondary"
              onPress={onRoute}
            />
            <Data className="text-meta text-paper mt-2 text-center">
              {`${formatDistance(shelter.distanceMetres)}, about ${shelter.walkMinutes} min on foot`}
            </Data>
          </>
        ) : null}

        <View className="mt-4 items-center">
          <Button
            label="I have seen this"
            variant="quiet-inverse"
            block={false}
            onPress={onAcknowledge}
          />
          <Subhead className="text-micro text-paper opacity-90 mt-1">
            Stops the alarm. The warning stays active.
          </Subhead>
        </View>
      </View>
    </SafeAreaView>
  );
}
