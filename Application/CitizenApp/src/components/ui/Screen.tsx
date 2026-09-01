import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../../theme/tokens';

interface ScreenProps {
  children: React.ReactNode;
  /** paper for reading screens, night for map and SOS. */
  ground?: 'paper' | 'night';
  edges?: readonly Edge[];
}

/**
 * Screen chrome. Exists so the status bar style and the safe-area ground can
 * never drift apart — a light status bar over a night ground is unreadable, and
 * that is the kind of thing that only shows up on someone else's phone.
 */
export default function Screen({
  children,
  ground = 'paper',
  edges = ['top', 'left', 'right'],
}: ScreenProps) {
  const isNight = ground === 'night';
  return (
    <SafeAreaView
      edges={edges}
      className={`flex-1 ${isNight ? 'bg-night' : 'bg-paper'}`}
    >
      <StatusBar
        barStyle={isNight ? 'light-content' : 'dark-content'}
        backgroundColor={isNight ? colors.night : colors.paper}
      />
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
