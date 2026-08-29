import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface AlertBannerProps {
  severity?: 'warning' | 'critical';
  title: string;
  message: string;
}

export default function AlertBanner({ severity = 'warning', title, message }: AlertBannerProps) {
  // Severity colors mapping based on the design system
  const bgClass = severity === 'critical' ? 'bg-rust' : 'bg-navy';
  const borderClass = 'border-gold';
  
  return (
    <View className={`flex-row items-center p-4 m-4 rounded-soft border border-b-2 ${bgClass} ${borderClass}`}>
      <AlertTriangle color="#B8863B" size={24} />
      <View className="ml-3 flex-1">
        <Text className="text-cream font-bold text-lg">{title}</Text>
        <Text className="text-cream text-sm opacity-90 mt-1 leading-5">{message}</Text>
      </View>
    </View>
  );
}
