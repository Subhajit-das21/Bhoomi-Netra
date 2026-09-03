import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import {
  Crosshair,
  MapPinOff,
  Maximize2,
  Minus,
  Navigation,
  Plus,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import Screen from '../components/ui/Screen';
import Button from '../components/ui/Button';
import ZoneMapCanvas, {
  districtBounds,
  focusBounds,
} from '../components/ZoneMapCanvas';
import { initialBasemapState, isTileSourceConfigured } from '../components/TileLayer';
import { Body, Data, Display, Subhead } from '../components/ui/Type';
import { useCitizen } from '../state/CitizenProvider';
import { occupancyLine } from '../domain/copy';
import { formatDistance } from '../domain/geo';
import {
  STREET_ZOOM,
  clampZoom,
  fitCamera,
  isOnScreen,
  metresPerPixel,
  panCamera,
  zoomCameraAround,
} from '../domain/mercator';
import { colors } from '../theme/tokens';
import type { BasemapState } from '../components/TileLayer';
import type { MapCamera, Viewport } from '../domain/mercator';
import type { LoadFailure, LoadState, RiskZone, ShelterWithRoute } from '../domain/types';

interface ZoneMapProps {
  onRoute: (shelter: ShelterWithRoute) => void;
}

/** Below this, a touch is a tap on a shelter marker and not a drag of the map. */
const DRAG_SLOP = 4;

/** Two taps closer together than this, near enough the same spot, mean "closer". */
const DOUBLE_TAP_MS = 280;
const DOUBLE_TAP_SLOP = 32;

/**
 * How far inside the edge a mark has to sit to count as visible. A destination
 * pin is a 15px square inside a casing ring, so anything less than this is a
 * marker with a bite taken out of it.
 */
const MARK_MARGIN_PX = 20;


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
  const [basemap, setBasemap] = useState<BasemapState>(initialBasemapState);

  const shown = selected ?? recommendedShelter;

  /**
   * Nothing to project. The canvas fits its bounds to the data it is given, so
   * with no zones and no shelters it would scale a single point to fill the
   * screen and draw a GPS accuracy ring several kilometres wide — a map that
   * looks confident and means nothing.
   */
  const nothingToDraw = zones.length === 0 && shelters.length === 0;

  /**
   * The opening frame is the neighbourhood, not the district.
   *
   * Deliberately keyed off `recommendedShelter` and not `shown`: tapping a distant
   * marker must not slide the map out from under the finger that tapped it. Use
   * the district control for that, where it is something you asked for.
   */
  const focus = useMemo(
    () => focusBounds(zones, shelters, position, recommendedShelter),
    [zones, shelters, position, recommendedShelter],
  );

  /**
   * Until the user touches the map it reframes itself around whatever has
   * arrived, so a zone that loads late is never left off the edge. The first
   * gesture takes that over for good: re-fitting under someone's finger would
   * yank the map away from the street name they were reading.
   */
  const fitted = useMemo(() => {
    if (!box || !focus) return null;
    const wide = fitCamera(focus, box);
    if (wide.zoom >= STREET_ZOOM) return wide;

    // The focus is wider than a legible street map. Pull in — a complete bounding
    // box you cannot read a lane name off answers neither question this screen
    // exists for, and everything cropped is one tap away on the district control.
    const close = { ...wide, zoom: STREET_ZOOM };
    if (!recommendedShelter) return close;

    // Unless pulling in would crop the shelter we are telling someone to walk to.
    // Then the wide frame wins: a guide line running off the edge of the screen
    // gives a bearing and nothing else, and "which way" is the whole instruction.
    return isOnScreen(close, box, recommendedShelter, MARK_MARGIN_PX)
      ? close
      : wide;
  }, [box, focus, recommendedShelter]);

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
      zoom: Math.max(c.zoom, STREET_ZOOM),
    });
  };

  /**
   * The whole district, hazards on the far side of the river included.
   *
   * This is the framing the map used to open with, kept as a control rather than
   * as a default. "Is anything else happening out there" is a real question; it is
   * just not the first one, and answering it first cost the map every street name.
   */
  const showDistrict = () => {
    const vp = viewportRef.current;
    const all = districtBounds(zones, shelters, position);
    if (!all || vp.width === 0) return;
    setMoved(fitCamera(all, vp));
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
              onBasemapState={setBasemap}
              width={box.width}
              height={box.height}
              onSelectShelter={setSelected}
            />
            <MapControls
              onZoomIn={() => step(1)}
              onZoomOut={() => step(-1)}
              onRecentre={recentre}
              onShowDistrict={showDistrict}
            />
            <ScaleBar
              metresPerPixel={metresPerPixel(camera.centre.latitude, camera.zoom)}
            />
            <MapCredit basemap={basemap} />
          </>
        ) : null}
      </View>

      {nothingToDraw ? null : <Legend zones={zones} shelters={shelters} />}


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

interface TapMark {
  at: number;
  x: number;
  y: number;
}

/**
 * One-finger pan, one-finger double tap, two-finger pinch, on React Native's own
 * PanResponder — react-native-gesture-handler is not installed, and for gestures
 * this simple it would not earn its place anyway.
 *
 * Three decisions worth knowing about:
 *
 * A touch that has not moved is never claimed. Shelter markers are tapped, and a
 * container that grabs every touch on start would swallow those taps; `DRAG_SLOP`
 * is what separates "I am choosing this shelter" from "I am moving the map".
 *
 * Double tap zooms in around the tap. It is here because pinch is the gesture
 * most likely to fail the people this app is for — one hand holding a child, a
 * wet screen, a phone in a plastic bag — and because a two-finger gesture on an
 * Android emulator needs a modifier key held down, so pinch is also the gesture
 * most likely to look broken while you are building. Detected from the *capture*
 * phase without claiming the touch, which is what lets a double tap coexist with
 * a single tap on a marker underneath.
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
  const lastTap = useRef<TapMark | null>(null);

  return useMemo(
    () =>
      PanResponder.create({
        // Never claims the touch. It is here to watch touch-downs so a double tap
        // can be recognised while single taps still reach the markers below.
        onStartShouldSetPanResponderCapture: (e) => {
          const camera = cameraRef.current;
          const viewport = viewportRef.current;
          if (!camera || viewport.width === 0) return false;
          // A second finger landing is not a tap. Without this, two fingers set
          // down close together would read as a double tap and zoom mid-pinch.
          if ((e.nativeEvent.touches?.length ?? 1) > 1) {
            lastTap.current = null;
            return false;
          }

          const now = Date.now();
          const at = localPoint(
            e.nativeEvent.pageX,
            e.nativeEvent.pageY,
            e.nativeEvent,
            viewport,
          );
          const prev = lastTap.current;
          if (
            prev &&
            now - prev.at < DOUBLE_TAP_MS &&
            Math.hypot(at.x - prev.x, at.y - prev.y) < DOUBLE_TAP_SLOP
          ) {
            lastTap.current = null;
            onCamera(
              zoomCameraAround(camera, viewport, at, clampZoom(camera.zoom + 1)),
            );
          } else {
            lastTap.current = { at: now, x: at.x, y: at.y };
          }
          return false;
        },
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

          const pair = twoTouches(e.nativeEvent);

          if (pair) {
            pan.current = null;
            const [a, b] = pair;
            const distance = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            // Two pointers reported at the same coordinate is not a pinch yet.
            if (!(distance > 0)) return;

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

          // Two fingers are down but the event did not carry both of them. Sit
          // still rather than treating it as a one-finger drag: reading a pinch as
          // a pan is what makes a map lurch sideways as you spread your fingers.
          if (g.numberActiveTouches > 1) return;

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

interface RawTouch {
  pageX: number;
  pageY: number;
}

/**
 * The two live pointers, or null.
 *
 * `touches` is the array to trust, but it is not guaranteed to be populated on
 * every platform for every event in the stream, and a pinch that silently reads
 * as a pan is worse than a pinch that does nothing. `changedTouches` is checked
 * as a second source, and both are validated as finite numbers before any
 * arithmetic — one NaN here propagates into the camera and blanks the map.
 */
function twoTouches(
  ev: { touches?: RawTouch[]; changedTouches?: RawTouch[] },
): [RawTouch, RawTouch] | null {
  const list =
    (ev.touches?.length ?? 0) >= 2
      ? ev.touches
      : (ev.changedTouches?.length ?? 0) >= 2
        ? ev.changedTouches
        : null;
  if (!list) return null;
  const [a, b] = list;
  if (!a || !b) return null;
  if (
    !Number.isFinite(a.pageX) ||
    !Number.isFinite(a.pageY) ||
    !Number.isFinite(b.pageX) ||
    !Number.isFinite(b.pageY)
  ) {
    return null;
  }
  return [a, b];
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
 * Zoom, recentre, and pull back to the district, as buttons.
 *
 * Pinch and double tap both work, but pinch assumes a free hand, a dry screen and
 * steady fingers, and this app is used by people who may have none of the three.
 * Square plates with no shadow and no rounding: they read as instrument controls
 * sitting on the map rather than as floating cards, and the pressed state swaps
 * the fill instead of dimming it, because a 50% dim is invisible in sunlight.
 *
 * Grouped as they are used — the two zoom plates touch, then a gap, then the two
 * framing plates. A single unbroken column of four reads as a toolbar you have to
 * parse; two pairs read as two jobs.
 */
function MapControls({
  onZoomIn,
  onZoomOut,
  onRecentre,
  onShowDistrict,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecentre: () => void;
  onShowDistrict: () => void;
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
          <MapControl
            icon={Maximize2}
            label="Show every zone and shelter in the district"
            onPress={onShowDistrict}
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
 * A scale bar, because "500 m" is a distance a person can walk and "zoom 15" is
 * not.
 *
 * It also does something no label can: it makes the hazard measurable. A flood
 * zone two bar-lengths wide is a kilometre of water, and a reader can work that
 * out at a glance without trusting a number we computed for them.
 *
 * The rounded step comes from the same 1-2-5 sequence surveyors use. The bar is
 * whatever pixel width that distance happens to be, so the number is exact and
 * the bar is the approximation — the other way round would be a lie in a diagram.
 */
const SCALE_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000];
const SCALE_MAX_PX = 110;

function ScaleBar({ metresPerPixel: mpp }: { metresPerPixel: number }) {
  if (!Number.isFinite(mpp) || mpp <= 0) return null;

  // Longest step that still fits. Falls back to the shortest when even that is
  // too wide, which only happens at a zoom this map cannot reach.
  const metres =
    [...SCALE_STEPS].reverse().find((m) => m / mpp <= SCALE_MAX_PX) ??
    SCALE_STEPS[0];
  const px = Math.round(metres / mpp);
  const label = metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;

  return (
    <View className="absolute bottom-7 left-2" pointerEvents="none">
      <Data className="text-micro text-paper opacity-80 mb-0.5">{label}</Data>
      <Svg width={px + 2} height={7}>
        {/* Dark casing under a cream rule, the same trick the map marks use, so
            the bar survives landing on a pale building. */}
        <Line x1={1} y1={4} x2={px + 1} y2={4} stroke={colors.night} strokeWidth={5} strokeOpacity={0.6} />
        <Line x1={1} y1={4} x2={px + 1} y2={4} stroke={colors.paper} strokeWidth={2} />
        <Line x1={1} y1={1} x2={1} y2={6} stroke={colors.paper} strokeWidth={2} />
        <Line x1={px + 1} y1={1} x2={px + 1} y2={6} stroke={colors.paper} strokeWidth={2} />
      </Svg>
    </View>
  );
}

/**
 * The tile licence requires a credit on the map, and the same line is the natural
 * place to be honest when there is no map to credit. A missing basemap is stated
 * rather than left as a plausible-looking dark rectangle: everything drawn on top
 * is still true, and the reader should know which part is missing.
 *
 * The attribution is read from the live basemap state rather than from a constant,
 * because the tile chain can fall back to a different provider at runtime and a
 * credit naming the wrong one is a licence breach, quietly.
 */
function MapCredit({ basemap }: { basemap: BasemapState }) {
  const line = !isTileSourceConfigured
    ? 'No street map in this build. Hazard geometry only.'
    : basemap.status === 'unavailable'
      ? 'Street map unreachable. Hazard geometry only.'
      : `Streets: ${basemap.attribution}`;

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
 *
 * It explains only what is drawn. A fire key over a district with no fire zone is
 * a reader looking for a mark that is not there, and five keys where three would
 * do is five things to read before you find your own street.
 */
function Legend({
  zones,
  shelters,
}: {
  zones: RiskZone[];
  shelters: ShelterWithRoute[];
}) {
  const flood = zones.some((z) => z.hazard_type === 'flood');
  const fire = zones.some((z) => z.hazard_type === 'fire');
  const open = shelters.some((s) => s.status === 'open');
  const shut = shelters.some((s) => s.status !== 'open');

  return (
    <View className="px-4 py-3 flex-row flex-wrap bg-night">
      {flood ? (
        <LegendItem label="Flood zone">
          <Rect
            x={1}
            y={3}
            width={16}
            height={12}
            fill={colors.critical}
            fillOpacity={0.46}
            stroke={colors.critical}
            strokeWidth={2}
          />
        </LegendItem>
      ) : null}

      {fire ? (
        <LegendItem label="Fire zone">
          <Rect
            x={1}
            y={3}
            width={16}
            height={12}
            fill={colors.high}
            fillOpacity={0.34}
            stroke={colors.high}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        </LegendItem>
      ) : null}

      {open ? (
        <LegendItem label="Shelter open">
          <Rect x={4} y={4} width={11} height={11} rx={2} fill={colors.olive} />
        </LegendItem>
      ) : null}

      {shut ? (
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
            strokeOpacity={0.85}
          />
          <Line
            x1={4}
            y1={15}
            x2={15}
            y2={4}
            stroke={colors.paper}
            strokeWidth={2}
            strokeOpacity={0.85}
          />
        </LegendItem>
      ) : null}

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
