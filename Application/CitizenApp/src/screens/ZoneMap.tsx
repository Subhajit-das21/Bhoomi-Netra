import React, { useState } from 'react';
import { View } from 'react-native';
import { MapPinOff, Navigation } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import ZoneMapCanvas from '../components/ZoneMapCanvas';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { useCitizen } from '../state/CitizenProvider';
import { occupancyLine } from '../domain/copy';
import { formatDistance } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { LoadFailure, LoadState, ShelterWithRoute } from '../domain/types';

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
    loadState,
    failure,
  } = useCitizen();

  const [selected, setSelected] = useState<ShelterWithRoute | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const shown = selected ?? recommendedShelter;

  /**
   * Nothing to project. The canvas fits its bounds to the data it is given, so
   * with no zones and no shelters it would scale a single point to fill the
   * screen and draw a GPS accuracy ring several kilometres wide — a map that
   * looks confident and means nothing.
   */
  const nothingToDraw = zones.length === 0 && shelters.length === 0;

  return (
    <Screen ground="night">
      <View className="px-4 pt-2 pb-3">
        <Display className="text-title text-paper">Zone map</Display>
        <Data className="text-micro text-paper opacity-70 mt-0.5">
          {containingZone
            ? `You are inside ${containingZone.name}`
            : zones.length > 0
              ? `${position.locality}, outside all marked zones`
              : position.locality}
        </Data>
      </View>

      <View
        className="flex-1"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setBox({ width, height });
        }}
      >
        {nothingToDraw ? (
          <NothingToMap state={loadState} failure={failure} />
        ) : box ? (
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

      {nothingToDraw ? null : <Legend />}

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
 * The map with no geometry to draw.
 *
 * Written on the night ground rather than handed to the shared `DataGap` card,
 * because a cream notice floating in the middle of a dark map is a different
 * screen wearing this one's chrome. Same rule as everywhere else though: an empty
 * map must not read as an empty district.
 */
function NothingToMap({
  state,
  failure,
}: {
  state: LoadState;
  failure: LoadFailure | null;
}) {
  const loading = state === 'first-load';
  return (
    <View className="flex-1 items-center justify-center px-8">
      <MapPinOff color={colors.brand} size={30} strokeWidth={2.5} />
      <Subhead className="text-body-lg text-paper mt-4 text-center">
        {loading ? 'Loading the district map' : 'No map data'}
      </Subhead>
      <Body className="text-meta text-paper opacity-80 mt-2 leading-5 text-center">
        {loading
          ? 'Fetching hazard zones and shelters.'
          : failure === 'unconfigured'
            ? 'This build has no data source, so it has no zones or shelters to show. That is a fault in the build, not a sign the district is clear.'
            : 'We could not load hazard zones or shelters. A blank map here does not mean the ground around you is safe — it means we do not know.'}
      </Body>
      {!loading ? (
        <Data className="text-micro text-paper opacity-70 mt-3 text-center leading-4">
          For anything happening right now, call 112.
        </Data>
      ) : null}
    </View>
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
