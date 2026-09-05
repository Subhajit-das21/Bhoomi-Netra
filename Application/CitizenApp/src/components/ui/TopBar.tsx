import React from 'react';
import { Pressable, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Subhead } from './Type';
import { useText } from '../../state/useText';
import { colors } from '../../theme/tokens';

interface TopBarProps {
  /**
   * What the user is leaving, named. "Back" alone makes people hesitate.
   *
   * Already translated by the caller — it is a word from that screen's own
   * vocabulary, not this component's.
   */
  backLabel: string;
  onBack: () => void;
  ground?: 'paper' | 'night';
  right?: React.ReactNode;
}

/**
 * Back navigation for pushed screens.
 *
 * The label names the destination rather than saying "Back", because on a screen
 * someone reached from a notification at 2 a.m. there is no memory of where back
 * is. The whole row is a 48dp target, not just the 20px chevron.
 */
export default function TopBar({
  backLabel,
  onBack,
  ground = 'paper',
  right,
}: TopBarProps) {
  const { t } = useText();
  const isNight = ground === 'night';
  const tint = isNight ? colors.paper : colors.ink;

  return (
    <View className="flex-row items-center justify-between pr-4">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('Back to {destination}', {
          destination: backLabel,
        })}
        className="flex-row items-center min-h-[48px] pl-2 pr-4"
      >
        {({ pressed }) => (
          <View className={`flex-row items-center ${pressed ? 'opacity-60' : ''}`}>
            <ChevronLeft color={tint} size={22} strokeWidth={2.5} />
            <Subhead
              className={`text-meta ml-0.5 ${isNight ? 'text-paper' : 'text-ink'}`}
            >
              {backLabel}
            </Subhead>
          </View>
        )}
      </Pressable>
      {right}
    </View>
  );
}
