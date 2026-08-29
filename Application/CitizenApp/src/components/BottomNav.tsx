import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { Home, Map as MapIcon, ShieldAlert, Settings } from 'lucide-react-native';

export default function BottomNav() {
  return (
    <View className="bg-navy flex-row justify-around items-center pt-4 pb-8 border-t border-gold/20">
      <TouchableOpacity className="items-center">
        <Home color="#B8863B" size={24} />
        <Text className="text-gold text-[10px] mt-1 font-body font-medium">Home</Text>
      </TouchableOpacity>
      <TouchableOpacity className="items-center opacity-60">
        <MapIcon color="#F0E6D2" size={24} />
        <Text className="text-cream text-[10px] mt-1 font-body">Zones</Text>
      </TouchableOpacity>
      <TouchableOpacity className="items-center opacity-60">
        <ShieldAlert color="#F0E6D2" size={24} />
        <Text className="text-cream text-[10px] mt-1 font-body">Alerts</Text>
      </TouchableOpacity>
      <TouchableOpacity className="items-center opacity-60">
        <Settings color="#F0E6D2" size={24} />
        <Text className="text-cream text-[10px] mt-1 font-body">Settings</Text>
      </TouchableOpacity>
    </View>
  );
}
