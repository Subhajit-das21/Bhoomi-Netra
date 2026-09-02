import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { Crosshair, MapPinOff, Minus, Navigation, Plus } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import ZoneMapCanvas, { mapBounds } from '../components/ZoneMapCanvas';
import { TILE_ATTRIBUTION, isTileSourceConfigured } from '../components/TileLayer';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { useCitizen } from '../state/CitizenProvider';
import { occupancyLine } from '../domain/copy';
import { formatDistance } from '../domain/geo';
import {
  clampZoom,
  fitCamera,
  panCamera,
  zoomCameraAround,
} from '../domain/mercator';
import { colors } from '../theme/tokens';
import type { BasemapStatus } from '../components/TileLayer';
import type { MapCamera, Viewport } from '../domain/mercator';
import type { LoadFailure, LoadState, ShelterWithRoute } from '../domain/types';

interface ZoneMapProps {
  onRoute: (shelter: ShelterWithRoute) => void;
}

/** Below this, a touch is a tap on a shelter marker and not a drag of the map. */
const DRAG_SLOP = 4;

/**
 * Where the hazard is, relative to where you are.
 *
 * The brief for this screen is restraint. The authority dashboard owns dense
 * geometry, heat gradients and sensor-by-sensor detail; a citizen needs to see
 * risk, self and refuge in one glance and then stop looking at their phone. So
 * there are five kinds of mark on this map and no more — over real streets,
 * because "walk to Deshapriya Park" needs a lane, not just a bearing.
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
  const [box, setBox] = useState<Viewport | null>(null);
  const [moved, setMoved] = useState<MapCamera | null>(null);
  const [basemap, setBasemap] = useState<BasemapStatus>('pending');

  const shown = selected ?? recommendedShelter;

  /**
   * Nothing to project. The canvas fits its bounds to the data it is given, so
   * with no zones and no shelters it would scale a single point to fill the
   * screen and draw a GPS accuracy ring several kilometres wide — a map that
   * looks confident and means nothing.
   */
  const nothingToDraw = zones.length === 0 && shelters.length === 0;

  const bounds = useMemo(
    () => mapBounds(zones, shelters, position),
    [zones, shelters, position],
  );

  /**
   * Until the user touches the map it reframes itself around whatever has
   * arrived, so a zone that loads late is never left off the edge. The first
   * gesture takes that over for good: re-fitting under someone's finger would
   * yank the map away from the street name they were reading.
   */
  const fitted = box && bounds ? fitCamera(bounds, box) : null;
  const camera = moved ?? fitted;

  // Read by the gesture handlers, which are created once and would otherwise
  // close over the first render's values forever.
  const cameraRef = useRef<MapCamera | null>(null);
  const viewportRef = useRef<Viewport>({ width: 0, height: 0 });
  cameraRef.current = camera;
  if (box) viewportRef.current = box;

  const responder = useMapGestures(cameraRef, viewportRef, setMoved);

  const recentre = () => {
    const c = cameraRef.current;
    if (!c) return;
    setMoved({
      centre: { longitude: position.longitude, latitude: position.latitude },
      zoom: c.zoom,
    });
  };

  /**
   * Buttons as well as pinch. A two-finger gesture assumes a free hand, a dry
   * screen and steady fingers, and this app is used by people who have none of
   * those. Rounding before stepping means the first tap always lands on a whole
   * zoom level rather than 14.37 + 1.
   */
  const step = (by: number) => {
    const c = cameraRef.current;
    const vp = viewportRef.current;
    if (!c || vp.width === 0) return;
    setMoved(
      zoomCameraAround(
        c,
        vp,
        { x: vp.width / 2, y: vp.height / 2 },
        clampZoom(Math.round(c.zoom) + by),
      ),
    );
  };

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
        {...responder.panHandlers}
      >
        {nothingToDraw ? (
          <NothingToMap state={loadState} failure={failure} />
        ) : box && camera ? (
          <>
            <ZoneMapCanvas
              zones={zones}
              shelters={shelters}
              position={position}
              destination={shown}
              camera={camera}
              basemap={basemap}
              onBasemapChange={setBasemap}
              width={box.width}
              height={box.height}
              onSelectShelter={setSelected}
            />
            <MapControls
              onZoomIn={() => step(1)}
              onZoomOut={() => step(-1)}
              onRecentre={recentre}
            />
            <MapCredit basemap={basemap} />
          </>
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

// ---------------------------------------------------------------------------
// Gestures
// ---------------------------------------------------------------------------

interface PanBase {
  camera: MapCamera;
  dx: number;
  dy: number;
}

interface PinchBase {
  camera: MapCamera;
  distance: number;
  focus: { x: number; y: number };
}

/**
 * One-finger pan, two-finger pinch, on React Native's own PanResponder —
 * react-native-gesture-handler is not installed, and for two gestures this
 * simple it would not earn its place anyway.
 *
 * Two decisions worth knowing about:
 *
 * A touch that has not moved is never claimed. Shelter markers are tapped, and a
 * container that grabs every touch on start would swallow those taps; `DRAG_SLOP`
 * is what separates "I am choosing this shelter" from "I am moving the map".
 *
 * Every frame is computed from the camera as it was when the gesture began, not
 * by accumulating deltas onto the last frame. Accumulation drifts, and worse, it
 * reads state that a fast finger can outrun. The base is re-taken whenever the
 * number of fingers changes, so lifting one finger out of a pinch continues as a
 * clean pan instead of jumping.
 */
function useMapGestures(
  cameraRef: React.RefObject<MapCamera | null>,
  viewportRef: React.RefObject<Viewport>,
  onCamera: (camera: MapCamera) => void,
) {
  const pan = useRef<PanBase | null>(null);
  const pinch = useRef<PinchBase | null>(null);

  return useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          g.numberActiveTouches === 2 || Math.hypot(g.dx, g.dy) > DRAG_SLOP,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          pan.current = null;
          pinch.current = null;
        },
        onPanResponderMove: (e, g) => {
          const camera = cameraRef.current;
          const viewport = viewportRef.current;
          if (!camera || viewport.width === 0) return;

          const touches = e.nativeEvent.touches;
          if (touches.length >= 2) {
            pan.current = null;
            const [a, b] = touches;
            const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            if (distance <= 0) return;

            if (!pinch.current) {
              pinch.current = {
                camera,
                distance,
                focus: localPoint(
                  (a.pageX + b.pageX) / 2,
                  (a.pageY + b.pageY) / 2,
                  e.nativeEvent,
                  viewport,
                ),
              };
              return;
            }

            const base = pinch.current;
            onCamera(
              zoomCameraAround(
                base.camera,
                viewport,
                base.focus,
                base.camera.zoom + Math.log2(distance / base.distance),
              ),
            );
            return;
          }

          pinch.current = null;
          if (!pan.current) {
            pan.current = { camera, dx: g.dx, dy: g.dy };
            return;
          }
          const base = pan.current;
          onCamera(panCamera(base.camera, g.dx - base.dx, g.dy - base.dy));
        },
        onPanResponderRelease: () => {
          pan.current = null;
          pinch.current = null;
        },
        onPanResponderTerminate: () => {
          pan.current = null;
          pinch.current = null;
        },
      }),
    [cameraRef, viewportRef, onCamera],
  );
}

/**
 * A page coordinate in the map's own pixels.
 *
 * `pageX - locationX` is the map view's own offset on screen, which saves an
 * async `measureInWindow` on every pinch. It holds because the only things under
 * a finger here are this container and the SVG that fills it edge to edge — the
 * tile layer takes no touches at all. If the platform gives us no location, the
 * centre of the screen is a safe anchor rather than a wrong one.
 */
function localPoint(
  pageX: number,
  pageY: number,
  ev: { pageX?: number; pageY?: number; locationX?: number; locationY?: number },
  viewport: Viewport,
): { x: number; y: number } {
  const offsetX = (ev.pageX ?? NaN) - (ev.locationX ?? NaN);
  const offsetY = (ev.pageY ?? NaN) - (ev.locationY ?? NaN);
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
    return { x: viewport.width / 2, y: viewport.height / 2 };
  }
  return {
    x: Math.min(Math.max(pageX - offsetX, 0), viewport.width),
    y: Math.min(Math.max(pageY - offsetY, 0), viewport.height),
  };
}

// ---------------------------------------------------------------------------
// Map chrome
// ---------------------------------------------------------------------------

/**
 * Zoom and recentre, as buttons.
 *
 * Pinch works, but it assumes a free hand, a dry screen and steady fingers, and
 * this app is used by people who may have none of the three. Square plates with
 * no shadow and no rounding: they read as instrument controls sitting on the map
 * rather than as floating cards, and the pressed state swaps the fill instead of
 * dimming it, because a 50% dim is invisible in sunlight.
 */
function MapControls({
  onZoomIn,
  onZoomOut,
  onRecentre,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecentre: () => void;
}) {
  return (
    <View className="absolute top-0 right-0">
      <View className="mt-3 mr-3">
        <MapControl icon={Plus} label="Zoom in" onPress={onZoomIn} />
        <MapControl icon={Minus} label="Zoom out" onPress={onZoomOut} />
        <View className="mt-2">
          <MapControl
            icon={Crosshair}
            label="Centre the map on my location"
            onPress={onRecentre}
          />
        </View>
      </View>
    </View>
  );
}

function MapControl({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => (
        <View
          className={`w-12 h-12 mb-0.5 items-center justify-center ${
            pressed ? 'bg-paper-deep' : 'bg-night-soft'
          }`}
        >
          <Icon
            color={pressed ? colors.ink : colors.paper}
            size={20}
            strokeWidth={2.5}
          />
        </View>
      )}
    </Pressable>
  );
}

/**
 * The tile licence requires a credit on the map, and the same line is the natural
 * place to be honest when there is no map to credit. A missing basemap is stated
 * rather than left as a plausible-looking dark rectangle: everything drawn on top
 * is still true, and the reader should know which part is missing.
 */
function MapCredit({ basemap }: { basemap: BasemapStatus }) {
  const line = !isTileSourceConfigured
    ? 'No street map in this build. Hazard geometry only.'
    : basemap === 'unavailable'
      ? 'Street map unreachable. Hazard geometry only.'
      : `Streets: ${TILE_ATTRIBUTION}`;

  return (
    // Never in the way of a marker underneath it: this line is read, not tapped.
    <View className="absolute bottom-0 left-0 bg-night px-2 py-1" pointerEvents="none">
      <Data className="text-micro text-paper opacity-70">{line}</Data>
    </View>
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
