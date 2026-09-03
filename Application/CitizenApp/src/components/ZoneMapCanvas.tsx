import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import TileLayer from './TileLayer';
import { SEVERITY } from '../domain/severity';
import { boundsOf, buildProjection } from '../domain/mercator';
import { distanceMetres, metresToPolygon } from '../domain/geo';
import { colors } from '../theme/tokens';
import type { BasemapState } from './TileLayer';
import type { Bounds, MapCamera, Projection } from '../domain/mercator';
import type {
  RiskZone,
  ShelterWithRoute,
  UserPosition,
} from '../domain/types';

interface ZoneMapCanvasProps {
  zones: RiskZone[];
  shelters: ShelterWithRoute[];
  position: UserPosition;
  /** Drawn with a guide line from the user. Null when nothing is reachable. */
  destination: ShelterWithRoute | null;
  /** Owned by the screen, because the screen owns the pan and pinch gestures. */
  camera: MapCamera;
  /**
   * Also owned by the screen: it has to name the tile source in the attribution
   * line, or say that there is no street map, and one truth beats two.
   */
  basemap: BasemapState;
  onBasemapState: (state: BasemapState) => void;
  width: number;
  height: number;
  onSelectShelter: (shelter: ShelterWithRoute) => void;
}


/**
 * The map.
 *
 * Two layers. Underneath, real street tiles in Web Mercator — because "walk to
 * Deshapriya Park" is only actionable if you can see which lane to turn down.
 * On top, in SVG, the five marks this app actually exists to show: hazard zones,
 * open shelters, closed shelters, you, and the direction of your refuge.
 *
 * The split is the design. A street map answers "where am I"; it has nothing to
 * say about where the water is, and at full strength its ten thousand other
 * facts bury the four that matter. So the basemap is dimmed to a substrate (see
 * `SCRIM` in TileLayer) and the hazard is the loudest thing on screen.
 *
 * When no tile source in the chain will answer, the layer removes itself and a
 * faint graticule takes its place. That is not an error state — it is the map this
 * screen had before tiles, and every mark on it is still true.
 *
 * Note that SVG is the one layer in this project where translucency is safe.
 * React Native's style parser rejects the `rgb(r g b / a)` syntax Tailwind emits,
 * which is why the theme pre-blends its tints; `fillOpacity` here is real alpha
 * compositing handled by the SVG renderer, so zones can genuinely wash over the
 * streets beneath them without pre-computed hexes.
 */
export default function ZoneMapCanvas({
  zones,
  shelters,
  position,
  destination,
  camera,
  basemap,
  onBasemapState,
  width,
  height,
  onSelectShelter,
}: ZoneMapCanvasProps) {
  const project = useMemo(
    () => buildProjection(camera, { width, height }),
    [camera, width, height],
  );

  const me = project(position.longitude, position.latitude);
  const target = destination
    ? project(destination.longitude, destination.latitude)
    : null;

  return (
    <View style={{ width, height, backgroundColor: colors.night }}>
      {/* Unmounted rather than hidden once the chain has proved unreachable, so
          there is one basemap status and not a second copy in here. */}
      {basemap.status === 'unavailable' ? null : (
        <TileLayer
          camera={camera}
          viewport={{ width, height }}
          onState={onBasemapState}
        />
      )}

      <Svg width={width} height={height}>
        {/* Only while there are no streets to measure against. Over a real
            basemap this is just interference. */}
        {basemap.status === 'ready' ? null : (
          <MapGrid width={width} height={height} />
        )}


        {zones.map((zone) => (
          <HazardZone key={zone.id} zone={zone} project={project} />
        ))}

        {/* A bearing, not a route. There are real streets underneath now, which
            makes the temptation to draw a path along them stronger and the honesty
            more important: we have not computed one yet, and on this screen an
            invented path is a wrong turn. The dashes say "direction".

            Drawn twice, dark under cream, for the same reason the zone labels are:
            a single hairline disappears wherever it crosses a pale building. */}
        {target ? (
          <G>
            <Line
              x1={me.x}
              y1={me.y}
              x2={target.x}
              y2={target.y}
              stroke={colors.night}
              strokeWidth={5}
              strokeOpacity={0.5}
            />
            <Line
              x1={me.x}
              y1={me.y}
              x2={target.x}
              y2={target.y}
              stroke={colors.paper}
              strokeWidth={2}
              strokeDasharray="3 6"
              strokeOpacity={0.85}
            />
          </G>
        ) : null}


        {shelters.map((shelter) => (
          <ShelterPin
            key={shelter.id}
            shelter={shelter}
            at={project(shelter.longitude, shelter.latitude)}
            isDestination={destination?.id === shelter.id}
            onPress={() => onSelectShelter(shelter)}
          />
        ))}

        <UserDot at={me} accuracyMetres={position.accuracyMetres} scale={project.metresPerPixel} />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

/**
 * How far the first frame reaches.
 *
 * 2.5 km is about a forty-minute walk for someone carrying a child, which is the
 * radius inside which a hazard is a decision rather than a news item.
 */
export const FOCUS_RADIUS_METRES = 2500;

/**
 * The neighbourhood: you, your refuge, and the hazards near enough to matter.
 *
 * This replaces an earlier "fit everything" rule, and the change was a bug fix,
 * not a preference. A district's zone list covers the whole district — Ward 58's
 * lanes and the Hooghly east bank are nine kilometres apart — so fitting all of
 * it produced a first frame at city scale, where the hazard you are standing in
 * is four pixels of colour and no street name is legible. That map answers
 * neither "am I in danger" nor "which way do I walk", which are the only two
 * questions it exists to answer.
 *
 * Far-off zones are not hidden; they are off the first frame. `districtBounds`
 * behind the "show everything" control puts them back, on purpose, as a choice.
 */
export function focusBounds(
  zones: RiskZone[],
  shelters: ShelterWithRoute[],
  position: UserPosition,
  destination: ShelterWithRoute | null,
): Bounds | null {
  const here = { latitude: position.latitude, longitude: position.longitude };
  const points = [{ longitude: position.longitude, latitude: position.latitude }];

  // Where you are going stays on screen however far it is. A frame that crops
  // your own destination is worse than a frame that is too wide.
  if (destination) {
    points.push({
      longitude: destination.longitude,
      latitude: destination.latitude,
    });
  }

  for (const z of zones) {
    if (metresToPolygon(here, z.polygon) > FOCUS_RADIUS_METRES) continue;
    for (const [longitude, latitude] of z.polygon) {
      points.push({ longitude, latitude });
    }
  }

  for (const s of shelters) {
    const away = distanceMetres(here, {
      latitude: s.latitude,
      longitude: s.longitude,
    });
    if (away <= FOCUS_RADIUS_METRES) {
      points.push({ longitude: s.longitude, latitude: s.latitude });
    }
  }

  // Nothing within walking distance. Rather than framing a single point — which
  // would zoom to a rooftop and say nothing — show the district and let the
  // emptiness around you be the message.
  if (points.length < 2) return districtBounds(zones, shelters, position);

  return boundsOf(points);
}

/**
 * Everything: you, every hazard vertex, every shelter.
 *
 * Bounds come from the data rather than a hardcoded box so this reframes itself
 * when the district adds a zone, instead of quietly cropping it off the edge.
 */
export function districtBounds(
  zones: RiskZone[],
  shelters: ShelterWithRoute[],
  position: UserPosition,
): Bounds | null {
  const points = [{ longitude: position.longitude, latitude: position.latitude }];
  for (const z of zones) {
    for (const [longitude, latitude] of z.polygon) {
      points.push({ longitude, latitude });
    }
  }
  for (const s of shelters) {
    points.push({ longitude: s.longitude, latitude: s.latitude });
  }
  return boundsOf(points);
}


/**
 * A hazard zone: the wash, its edge, and its name set inside it.
 *
 * Severity is fill weight, not hue — the same rule the alert cards use, so the
 * map and the feed escalate in one language. `rank` runs 1..4, and both the wash
 * and the edge thicken with it, which means a critical zone still reads as the
 * loudest thing here in greyscale, to a colourblind reader, and in sunlight.
 *
 * Hue is the second channel and line quality is the third: dashed for fire,
 * solid for flood. Nothing on this map depends on colour alone.
 */
const ZONE_FILL = [0.16, 0.24, 0.34, 0.46];
const ZONE_EDGE = [1.5, 2, 2.5, 3.5];

/** Below this on-screen area a label is noise sitting on top of a smudge. */
const LABEL_MIN_AREA_PX = 2600;

function HazardZone({
  zone,
  project,
}: {
  zone: RiskZone;
  project: Projection;
}) {
  const s = SEVERITY[zone.severity];
  const step = Math.min(Math.max(s.rank, 1), 4) - 1;
  const points = zone.polygon.map(([lng, lat]) => project(lng, lat));
  const d =
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ') + ' Z';

  return (
    <G>
      {/* A dark casing under the edge. Kolkata's basemap is full of pale
          buildings and a terracotta hairline vanishes over them. */}
      <Path
        d={d}
        fill="none"
        stroke={colors.night}
        strokeWidth={ZONE_EDGE[step] + 2.5}
        strokeOpacity={0.45}
      />
      <Path
        d={d}
        fill={s.accent}
        fillOpacity={ZONE_FILL[step]}
        stroke={s.accent}
        strokeWidth={ZONE_EDGE[step]}
        strokeDasharray={zone.hazard_type === 'fire' ? '7 5' : undefined}
      />
      <ZoneLabel zone={zone} points={points} />
    </G>
  );
}


// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

/**
 * A faint graticule, drawn only when there is no basemap under the marks. Gives
 * the eye something to measure against so the shapes read as places rather than
 * as abstract blobs, without pretending to be streets it does not know.
 */
function MapGrid({ width, height }: { width: number; height: number }) {
  const step = 46;
  const lines: React.ReactElement[] = [];
  for (let x = step; x < width; x += step) {
    lines.push(
      <Line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={height}
        stroke={colors.paper}
        strokeWidth={0.5}
        strokeOpacity={0.07}
      />,
    );
  }
  for (let y = step; y < height; y += step) {
    lines.push(
      <Line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={width}
        y2={y}
        stroke={colors.paper}
        strokeWidth={0.5}
        strokeOpacity={0.07}
      />,
    );
  }
  return <G>{lines}</G>;
}

/**
 * The zone's own name, set inside it. A legend you have to cross-reference is a
 * legend nobody reads.
 *
 * Drawn twice: a dark stroke first, then the cream fill over it. That is the
 * ordinary cartographic halo, and it is what lets 10px type stay readable when it
 * lands on a street, a river or a building edge rather than on flat colour.
 *
 * Suppressed when the shape is too small to hold it. A label wider than the thing
 * it names stops being a label and becomes a caption floating over a smudge, and
 * at district zoom every zone hits that at once.
 */
function ZoneLabel({
  zone,
  points,
}: {
  zone: RiskZone;
  points: { x: number; y: number }[];
}) {
  if (points.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    sumX += p.x;
    sumY += p.y;
  }
  if ((maxX - minX) * (maxY - minY) < LABEL_MIN_AREA_PX) return null;

  const cx = sumX / points.length;
  const cy = sumY / points.length;
  const label = zone.name.toUpperCase();

  return (
    <G>
      <SvgText
        x={cx}
        y={cy}
        fill="none"
        stroke={colors.night}
        strokeWidth={3.5}
        strokeOpacity={0.85}
        fontSize={10}
        fontWeight="700"
        textAnchor="middle"
      >
        {label}
      </SvgText>
      <SvgText
        x={cx}
        y={cy}
        fill={colors.paper}
        fontSize={10}
        fontWeight="700"
        textAnchor="middle"
      >
        {label}
      </SvgText>
    </G>
  );
}


/**
 * Shelters. Open is a filled square, full or closed is an outline with a bar
 * through it — a shape difference, so "do not walk here" survives greyscale and
 * does not rely on the reader distinguishing olive from terracotta at 9px.
 *
 * Every mark carries a dark casing underneath. The basemap can be Esri's grey
 * artwork or, after a fallback, a darkened OSM full of pale buildings, and a mark
 * that only reads over one of those is a mark that sometimes disappears.
 */
function ShelterPin({
  shelter,
  at,
  isDestination,
  onPress,
}: {
  shelter: ShelterWithRoute;
  at: { x: number; y: number };
  isDestination: boolean;
  onPress: () => void;
}) {
  const open = shelter.status === 'open';
  const size = isDestination ? 15 : 12;
  const half = size / 2;

  return (
    <G onPress={onPress}>
      {/* Invisible 44px target, because a 12px square is not tappable. */}
      <Circle cx={at.x} cy={at.y} r={22} fill="transparent" />

      {isDestination ? (
        <G>
          <Circle
            cx={at.x}
            cy={at.y}
            r={half + 6}
            fill="none"
            stroke={colors.night}
            strokeWidth={4.5}
            strokeOpacity={0.55}
          />
          <Circle
            cx={at.x}
            cy={at.y}
            r={half + 6}
            fill="none"
            stroke={colors.paper}
            strokeWidth={2}
          />
        </G>
      ) : null}

      <Rect
        x={at.x - half - 1}
        y={at.y - half - 1}
        width={size + 2}
        height={size + 2}
        rx={3}
        fill="none"
        stroke={colors.night}
        strokeWidth={3}
        strokeOpacity={0.55}
      />

      <Rect
        x={at.x - half}
        y={at.y - half}
        width={size}
        height={size}
        rx={2}
        fill={open ? colors.olive : 'none'}
        stroke={open ? colors.olive : colors.paper}
        strokeWidth={2}
        strokeOpacity={open ? 1 : 0.85}
      />

      {!open ? (
        <Line
          x1={at.x - half}
          y1={at.y + half}
          x2={at.x + half}
          y2={at.y - half}
          stroke={colors.paper}
          strokeWidth={2}
          strokeOpacity={0.85}
        />
      ) : null}
    </G>
  );
}


/**
 * The user. A solid dot inside a ring drawn at true GPS accuracy — so an 18 m
 * fix looks tight and a 200 m fix visibly does not promise where you are. The
 * ring is the honest part of this mark.
 */
function UserDot({
  at,
  accuracyMetres,
  scale,
}: {
  at: { x: number; y: number };
  accuracyMetres: number;
  scale: number;
}) {
  const ring = Math.max(9, accuracyMetres / scale);

  return (
    <G>
      <Circle
        cx={at.x}
        cy={at.y}
        r={ring}
        fill={colors.brand}
        fillOpacity={0.2}
        stroke={colors.brand}
        strokeWidth={1}
        strokeOpacity={0.6}
      />
      <Circle cx={at.x} cy={at.y} r={6} fill={colors.brand} />
      <Circle
        cx={at.x}
        cy={at.y}
        r={6}
        fill="none"
        stroke={colors.night}
        strokeWidth={2}
      />
    </G>
  );
}
