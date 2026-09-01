import React from 'react';
import { ScrollView, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Droplets, Flame, Wind, Radio } from 'lucide-react-native';
import AlertBanner from './src/components/AlertBanner';
import SensorTile from './src/components/SensorTile';
import BottomNav from './src/components/BottomNav';
import { Body, Data, Display, Subhead } from './src/components/ui/Type';
import { colors } from './src/theme/tokens';

export default function App() {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="px-5 py-4 flex-row justify-between items-center">
          <View className="flex-1">
            <Display className="text-night text-headline">BHOOMI-NETRA</Display>
            <Body className="text-ink-soft text-meta mt-0.5">
              Ward 58, Kolkata
            </Body>
          </View>
          <View className="flex-row items-center bg-olive px-3 py-1.5 rounded-full">
            <Radio color={colors.paper} size={14} strokeWidth={2.5} />
            <Subhead className="text-paper text-micro ml-1.5">LIVE</Subhead>
          </View>
        </View>

        <AlertBanner
          severity="critical"
          title="Leave now — water rising in Ward 58"
          message="The Hooghly is 3.1m above the danger mark at Howrah Bridge. Walk to Deshapriya Park shelter, 400m north."
        />

        {/* Map placeholder. Replaced by the SVG zone map in a later commit. */}
        <View className="mx-4 mb-3 h-48 bg-night rounded-lg overflow-hidden justify-center items-center">
          {/* Risk zones read as layered translucent fills. React Native has no
              blur primitive, so the previous blur-xl classes did nothing. */}
          <View className="absolute top-6 left-6 w-32 h-32 rounded-full bg-critical opacity-40" />
          <View className="absolute top-10 left-10 w-24 h-24 rounded-full bg-critical opacity-50" />
          <View className="absolute bottom-5 right-8 w-24 h-24 rounded-full bg-high opacity-30" />
          <Subhead className="text-paper text-title">Zone map</Subhead>
          <Body className="text-paper text-meta mt-1 opacity-80">
            Shelters and risk zones
          </Body>
        </View>

        {/* Live telemetry */}
        <View className="px-4 pb-2">
          <View className="flex-row items-baseline justify-between mb-2 px-1">
            <Subhead className="text-night text-title">Sensors near you</Subhead>
            <Data className="text-ink-soft text-micro">2 min ago</Data>
          </View>

          <View className="flex-row mb-2">
            <SensorTile
              icon={Droplets}
              label="Water level"
              value="3100"
              unit="/4095"
              status="high"
            />
            <SensorTile
              icon={Flame}
              label="Temperature"
              value="29.8"
              unit="°C"
              status="ok"
            />
          </View>

          <View className="flex-row">
            <SensorTile
              icon={Wind}
              label="Smoke"
              value="140"
              unit="ppm"
              status="ok"
            />
            <SensorTile
              icon={Droplets}
              label="Rainfall"
              value="310"
              unit="mm"
              status="medium"
            />
          </View>
        </View>

        {/* All-clear note */}
        <View className="mx-4 mt-2 mb-8 flex-row rounded-md overflow-hidden bg-paper-deep">
          {/* self-stretch, not h-full: h-full inside a flex row with no fixed
              parent height resolves to zero on Android. */}
          <View className="w-1.5 self-stretch bg-olive" />
          <Body className="text-ink text-body flex-1 p-3 leading-6">
            Shelters at Deshapriya Park and Jadavpur Campus are open and below
            capacity. Both are reachable on foot.
          </Body>
        </View>
      </ScrollView>

      <BottomNav active="home" />
    </SafeAreaView>
  );
}
