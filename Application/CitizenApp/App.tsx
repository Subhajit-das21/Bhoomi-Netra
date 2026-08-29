import React from 'react';
import { SafeAreaView, ScrollView, View, Text, StatusBar, ImageBackground } from 'react-native';
import { Droplets, Flame, Wind, Activity } from 'lucide-react-native';
import AlertBanner from './src/components/AlertBanner';
import SensorTile from './src/components/SensorTile';
import BottomNav from './src/components/BottomNav';

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-cream">
      <StatusBar barStyle="dark-content" backgroundColor="#F0E6D2" />
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-6 py-4 flex-row justify-between items-center border-b border-navy/10">
          <View>
            <Text className="text-navy font-display text-2xl font-bold tracking-tight">BHOOMI-NETRA</Text>
            <Text className="text-ink/60 font-body text-xs">Sector 5, Kolkata • Safe Zone</Text>
          </View>
          <View className="w-10 h-10 bg-navy rounded-full border-2 border-gold items-center justify-center">
            {/* Watchtower/beacon motif */}
            <Activity color="#B8863B" size={20} />
          </View>
        </View>

        {/* Critical Alert Example */}
        <AlertBanner 
          severity="critical"
          title="Evacuation Advisory"
          message="Water levels rising rapidly in Ward 58. Move to high ground immediately. Follow shelter routing."
        />

        {/* Map Placeholder */}
        <View className="mx-4 my-2 h-48 bg-navy rounded-soft border border-gold/30 overflow-hidden relative justify-center items-center">
          {/* Faux rust-red heatmap zone */}
          <View className="absolute top-4 left-4 w-32 h-32 bg-rust/40 rounded-full blur-xl" />
          <View className="absolute bottom-4 right-10 w-24 h-24 bg-rust/30 rounded-full blur-xl" />
          
          <Text className="text-gold font-display opacity-80 text-lg">Interactive Map Zone</Text>
          <Text className="text-cream/70 font-body text-xs mt-1">Shelters & Heatmaps rendered here</Text>
        </View>

        {/* Live Telemetry Section */}
        <View className="px-5 py-4">
          <Text className="text-navy font-display text-lg mb-3">Live Telemetry</Text>
          
          <View className="flex-row mb-2">
            <SensorTile icon={Droplets} label="Water Lvl" value="450" unit="mm" severity="safe" />
            <SensorTile icon={Flame} label="Temp" value="38.5" unit="°C" severity="warning" />
          </View>
          
          <View className="flex-row">
            <SensorTile icon={Wind} label="Air Qual" value="120" unit="AQI" severity="watch" />
            <SensorTile icon={Activity} label="Status" value="Live" unit="" severity="safe" />
          </View>
        </View>
        
        {/* Safe Zone Message */}
        <View className="mx-4 mt-2 mb-8 p-4 bg-success-olive/10 rounded-soft border border-success-olive/30 flex-row items-center">
          <View className="w-2 h-full bg-success-olive rounded-full mr-3" />
          <Text className="text-ink/80 font-body text-sm flex-1 leading-5">
            Your immediate area is currently stable. Local shelters are operating at normal capacity.
          </Text>
        </View>

      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav />
    </SafeAreaView>
  );
}
