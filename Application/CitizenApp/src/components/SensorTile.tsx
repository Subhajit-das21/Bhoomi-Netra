import React from 'react';
import { View, Text } from 'react-native';

export default function SensorTile({ icon: Icon, label, value, unit, severity = 'safe' }) {
  const severityColors = {
    'safe': 'bg-success-olive',
    'watch': 'bg-gold',
    'warning': 'bg-clay',
    'critical': 'bg-rust',
  };

  return (
    <View className="bg-cream p-4 rounded-softer border border-gold/30 flex-1 m-1 relative overflow-hidden flex-row items-center justify-between shadow-sm">
      <View className="flex-row items-center gap-3">
        <View className="p-2 bg-navy/5 rounded-full border border-gold/40">
          {Icon && <Icon color="#B8863B" size={20} strokeWidth={1.5} />}
        </View>
        <View>
          <Text className="text-ink/60 font-body text-xs uppercase tracking-widest mb-0.5">{label}</Text>
          <View className="flex-row items-baseline gap-1">
            <Text className="text-ink font-mono font-bold text-lg">{value}</Text>
            <Text className="text-ink/60 font-mono text-xs">{unit}</Text>
          </View>
        </View>
      </View>
      <View className={`w-3 h-3 rounded-full ${severityColors[severity]} shadow-sm border border-cream`} />
    </View>
  );
}
