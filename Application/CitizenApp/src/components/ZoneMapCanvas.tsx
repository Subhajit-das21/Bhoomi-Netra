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
import { colors } from '../theme/tokens';
import type { BasemapStatus } from './TileLayer';
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
  basemap: BasemapStatus;
  onBasemapChange: (status: BasemapStatus) => void;
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
 * `SCRIM_OPACITY` in TileLayer) and the hazard is the loudest thing on screen.
 *
 * When tiles cannot load, the layer removes itself and a faint graticule takes
 * its place. That is not an error state — it is the map this screen had before
 * tiles, and every mark on it is still true.
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
  onBasemapChange,
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
      <TileLayer
        camera={camera}
        viewport={{ width, height }}
        onReady={() => onBasemapChange('ready')}
        onUnavailable={() => onBasemapChange('unavailable')}
      />

      <Svg width={width} height={height}>
        {/* Only while there are no streets to measure against. Over a real
            basemap this is just interference. */}
        {basemap === 'ready' ? null : (
          <MapGrid width={width} height={height} />
        )}

        {zones.map((zone) => {
          const s = SEVERITY[zone.severity];
          return (
            <G key={zone.id}>
              <Path
                d={ringPath(zone.polygon, project)}
                fill={s.accent}
                fillOpacity={zone.severity === 'critical' ? 0.42 : 0.26}
                stroke={s.accent}
                strokeWidth={2}
                // Dashed for fire, solid for flood: the hazard is legible as a
                // line quality, so the map does not depend on hue alone.
                strokeDasharray={zone.hazard_type === 'fire' ? '7 5' : undefined}
              />
              <ZoneLabel zone={zone} project={project} />
            </G>
          );
        })}

        {/* A bearing, not a route. There are real streets underneath now, which
            makes the temptation to draw a path along them stronger and the honesty
            more important: we have not computed one yet, and on this screen an
            invented path is a wrong turn. The dashes say "direction". */}
        {target ? (
          <Line
            x1={me.x}
            y1={me.y}
            x2={target.x}
            y2={target.y}
            stroke={colors.paper}
            strokeWidth={2}
            strokeDasharray="3 6"
            strokeOpacity={0.75}
          />
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
 * Everything that must stay on screen: you, every hazard vertex, every shelter.
 *
 * Bounds come from the data rather than a hardcoded box so the map reframes
 * itself when the district adds a zone, instead of quietly cropping it off the
 * edge. The screen turns this into a camera with `fitCamera`.
 */
export function mapBounds(
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

function ringPath(
  ring: [number, number][],
  project: Projection,
): string {
  return (
    ring
      .map(([lng, lat], i) => {
        const p = project(lng, lat);
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      })
      .join(' ') + ' Z'
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
 */
function ZoneLabel({
  zone,
  project,
}: {
  zone: RiskZone;
  project: Projection;
}) {
  const points = zone.polygon.map(([lng, lat]) => project(lng, lat));
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
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
        <Circle
          cx={at.x}
          cy={at.y}
          r={half + 6}
          fill="none"
          stroke={colors.paper}
          strokeWidth={2}
        />
      ) : null}

      <Rect
        x={at.x - half}
        y={at.y - half}
        width={size}
        height={size}
        rx={2}
        fill={open ? colors.olive : 'none'}
        stroke={open ? colors.olive : colors.paper}
        strokeWidth={2}
        strokeOpacity={open ? 1 : 0.7}
      />

      {!open ? (
        <Line
          x1={at.x - half}
          y1={at.y + half}
          x2={at.x + half}
          y2={at.y - half}
          stroke={colors.paper}
          strokeWidth={2}
          strokeOpacity={0.7}
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
