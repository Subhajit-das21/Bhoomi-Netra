import React, { useState } from 'react';
import { View } from 'react-native';
import { Navigation } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import ZoneMapCanvas from '../components/ZoneMapCanvas';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { useCitizen } from '../state/CitizenProvider';
import { occupancyLine } from '../domain/copy';
import { formatDistance } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { ShelterWithRoute } from '../domain/types';

interface ZoneMapProps {
  onRoute: (shelter: ShelterWithRoute) => void;
}

/**
 * Where the hazard is, relative to where you are.
 *
 * The brief for this screen is restraint. The authority dashboard owns dense
 * geometry, heat gradients and sensor-by-sensor detail; a citizen needs to see
 * risk, self and refuge in one glance and then stop looking at their phone. So
 * there are five kinds of mark on this map and no more.
 *
 * A shelter is selected by tapping it. Nothing auto-opens, because a panel that
 * springs up over the map on load is a panel covering the thing you came to see.
 */
export default function ZoneMap({ onRoute }: ZoneMapProps) {
  const {
    zones,
    shelters,
    position,
    recommendedShelter,
    containingZone,
  } = useCitizen();

  const [selected, setSelected] = useState<ShelterWithRoute | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const shown = selected ?? recommendedShelter;

  return (
    <Screen ground="night">
      <View className="px-4 pt-2 pb-3">
        <Display className="text-title text-paper">Zone map</Display>
        <Data className="text-micro text-paper opacity-70 mt-0.5">
          {containingZone
            ? `You are inside ${containingZone.name}`
            : `${position.locality}, outside all marked zones`}
        </Data>
      </View>

      <View
        className="flex-1"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBox({ width, height });
        }}
      >
        {box ? (
          <ZoneMapCanvas
            zones={zones}
            shelters={shelters}
            position={position}
            destination={shown}
            width={box.width}
            height={box.height}
            onSelectShelter={setSelected}
          />
        ) : null}
      </View>

      <Legend />

      {shown ? (
        <View className="bg-night-soft px-4 pt-4 pb-2">
          <Subhead className="text-body-lg text-paper">{shown.name}</Subhead>
          <Data className="text-meta text-paper opacity-80 mt-1">
            {`${formatDistance(shown.distanceMetres)} away, ${shown.walkMinutes} min on foot`}
          </Data>
          <Data className="text-micro text-paper opacity-70 mt-0.5">
            {occupancyLine(shown)}
          </Data>

          {shown.status === 'open' ? (
            <View className="mt-3">
              <Button
                label="Walk here"
                icon={Navigation}
                onPress={() => onRoute(shown)}
              />
            </View>
          ) : (
            <Body className="text-meta text-paper mt-3 leading-5">
              This shelter is not taking people. Tap another marker to pick a
              different one.
            </Body>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

/**
 * The legend draws its own swatches with the same SVG primitives the map uses,
 * so a swatch can never drift from the mark it explains — the usual failure of a
 * legend built out of coloured divs next to a canvas.
 */
function Legend() {
  return (
    <View className="px-4 py-3 flex-row flex-wrap bg-night">
      <LegendItem label="Flood zone">
        <Rect
          x={1}
          y={3}
          width={16}
          height={12}
          fill={colors.critical}
          fillOpacity={0.42}
          stroke={colors.critical}
          strokeWidth={2}
        />
      </LegendItem>

      <LegendItem label="Fire zone">
        <Rect
          x={1}
          y={3}
          width={16}
          height={12}
          fill={colors.high}
          fillOpacity={0.26}
          stroke={colors.high}
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      </LegendItem>

      <LegendItem label="Shelter open">
        <Rect x={4} y={4} width={11} height={11} rx={2} fill={colors.olive} />
      </LegendItem>

      <LegendItem label="Full or closed">
        <Rect
          x={4}
          y={4}
          width={11}
          height={11}
          rx={2}
          fill="none"
          stroke={colors.paper}
          strokeWidth={2}
          strokeOpacity={0.7}
        />
        <Line
          x1={4}
          y1={15}
          x2={15}
          y2={4}
          stroke={colors.paper}
          strokeWidth={2}
          strokeOpacity={0.7}
        />
      </LegendItem>

      <LegendItem label="You">
        <Circle
          cx={9}
          cy={9}
          r={8}
          fill={colors.brand}
          fillOpacity={0.2}
          stroke={colors.brand}
          strokeWidth={1}
        />
        <Circle cx={9} cy={9} r={4} fill={colors.brand} />
      </LegendItem>
    </View>
  );
}

function LegendItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center mr-4 mb-1">
      <Svg width={18} height={18}>
        {children}
      </Svg>
      <Data className="text-micro text-paper opacity-80 ml-1.5">{label}</Data>
    </View>
  );
}
