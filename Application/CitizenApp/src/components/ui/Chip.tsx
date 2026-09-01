import React from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Subhead } from './Type';

interface ChipProps {
  label: string;
  /** Background and text classes, normally taken from SEVERITY. */
  fill: string;
  text: string;
  icon?: LucideIcon;
  iconColor?: string;
}

/**
 * A small solid label. Used for severity, shelter status and data freshness.
 *
 * Solid fill rather than a tinted pill because a chip is often the only piece
 * of colour on a card, and it has to survive being read at arm's length.
 */
export default function Chip({ label, fill, text, icon: Icon, iconColor }: ChipProps) {
  return (
    <View className={`flex-row items-center px-2 py-1 rounded-sm ${fill}`}>
      {Icon && iconColor ? (
        <View className="mr-1.5">
          <Icon color={iconColor} size={13} strokeWidth={3} />
        </View>
      ) : null}
      <Subhead className={`text-micro ${text}`}>{label.toUpperCase()}</Subhead>
    </View>
  );
}
