import React from 'react';
import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Body, Data } from './ui/Type';
import { colors } from '../theme/tokens';
import type { Severity } from '../domain/types';

interface SensorTileProps {
  icon?: LucideIcon;
  label: string;
  value: string;
  unit: string;
  /** 'ok' means the reading is inside its safe band; the rest match alerts.severity. */
  status?: 'ok' | Severity;
}

/**
 * Previously mapped 'safe' to `bg-success-olive`, a class that was never
 * defined in tailwind.config.js — the status dot rendered with no fill at all.
 * Now driven by real tokens.
 */
const dot: Record<'ok' | Severity, string> = {
  ok: 'bg-olive',
  low: 'bg-low',
  medium: 'bg-medium',
  high: 'bg-high',
  critical: 'bg-critical',
};

export default function SensorTile({
  icon: Icon,
  label,
  value,
  unit,
  status = 'ok',
}: SensorTileProps) {
  return (
    <View className="bg-paper-deep p-3 rounded-md flex-1 mx-1 flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        {Icon ? (
          <View className="mr-3">
            <Icon color={colors['ink-soft']} size={20} strokeWidth={2} />
          </View>
        ) : null}
        <View className="flex-1">
          <Body className="text-ink-soft text-micro mb-0.5">{label}</Body>
          <View className="flex-row items-baseline">
            <Data className="text-ink text-body-lg font-bold">{value}</Data>
            {unit ? (
              <Data className="text-ink-soft text-meta ml-1">{unit}</Data>
            ) : null}
          </View>
        </View>
      </View>
      <View className={`w-3 h-3 rounded-full ${dot[status]}`} />
    </View>
  );
}
