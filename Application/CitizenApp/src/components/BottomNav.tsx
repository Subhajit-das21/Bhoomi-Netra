import React from 'react';
import { View, Pressable } from 'react-native';
import { Home, Map as MapIcon, ShieldAlert, Settings } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Subhead } from './ui/Type';
import { colors } from '../theme/tokens';

export type TabKey = 'home' | 'map' | 'sos' | 'settings';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'home', label: 'Alerts', icon: Home },
  { key: 'map', label: 'Map', icon: MapIcon },
  { key: 'sos', label: 'SOS', icon: ShieldAlert },
  { key: 'settings', label: 'Settings', icon: Settings },
];

interface BottomNavProps {
  active?: TabKey;
  onChange?: (key: TabKey) => void;
}

export default function BottomNav({ active = 'home', onChange }: BottomNavProps) {
  return (
    <View className="bg-night flex-row pt-2 pb-6 px-2">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            onPress={() => onChange?.(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            className="flex-1 items-center py-2 rounded-md"
          >
            {/* Active state is a filled bar above the icon, not just a colour
                swap — colour alone is not enough of a signal outdoors. */}
            <View
              className={`h-1 w-8 rounded-full mb-2 ${
                isActive ? 'bg-brand' : 'bg-transparent'
              }`}
            />
            <Icon
              color={isActive ? colors.brand : colors.paper}
              size={24}
              strokeWidth={isActive ? 2.5 : 1.75}
            />
            <Subhead
              className={`text-micro mt-1 ${
                isActive ? 'text-brand' : 'text-paper'
              }`}
            >
              {label}
            </Subhead>
          </Pressable>
        );
      })}
    </View>
  );
}
