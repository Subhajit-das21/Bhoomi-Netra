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
import { SEVERITY } from '../domain/severity';
import { colors } from '../theme/tokens';
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
  width: number;
  height: number;
  onSelectShelter: (shelter: ShelterWithRoute) => void;
}

/**
 * The map.
 *
 * Hand-drawn in SVG rather than embedded from a tile provider. Two reasons, in
 * order of importance:
 *
 *   1. A citizen looking at this in a flood needs four facts — where I am, where
 *      the water is, where the shelters are, which way to walk. A street map
 *      carries ten thousand other facts, and every one of them is noise at that
 *      moment. Removing the basemap is the design decision, not a limitation.
 *   2. react-native-maps is not installed and the registry is unreachable here.
 *
 * It also sidesteps the look the brief warned against: a Google basemap with one
 * bright accent dropped on top is the most recognisable stock-template tell in
 * mobile design, and it would make this screen look like every delivery app.
 *
 * Note that SVG is the one layer in this project where translucency is safe.
 * React Native's style parser rejects the `rgb(r g b / a)` syntax Tailwind emits,
 * which is why the theme pre-blends its tints; `fillOpacity` here is real alpha
 * compositing handled by the SVG renderer, so zones can genuinely wash over each
 * other without pre-computed hexes.
 */
export default function ZoneMapCanvas({
  zones,
  shelters,
  position,
  destination,
  width,
  height,
  onSelectShelter,
}: ZoneMapCanvasProps) {
  const project = useMemo(
    () => buildProjection(zones, shelters, position, width, height),
    [zones, shelters, position, width, height],
  );

  const me = project(position.longitude, position.latitude);
  const target = destination
    ? project(destination.longitude, destination.latitude)
    : null;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={colors.night} />

        <MapGrid width={width} height={height} />

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
                strokeDasharray={zone.hazard === 'fire' ? '7 5' : undefined}
              />
              <ZoneLabel zone={zone} project={project} />
            </G>
          );
        })}

        {/* Direct line, not a route. Drawing a street-following path we have not
            computed would be a lie, and on this screen a lie is a wrong turn. */}
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
// Projection
// ---------------------------------------------------------------------------

interface Projection {
  (lng: number, lat: number): { x: number; y: number };
  metresPerPixel: number;
}

/**
 * Equirectangular fit over everything that must be visible, with longitude
 * scaled by cos(latitude) so Kolkata is not stretched sideways. Bounds are
 * computed from the data rather than hardcoded, so the map reframes itself when
 * a new zone or shelter appears instead of quietly cropping it off the edge.
 */
function buildProjection(
  zones: RiskZone[],
  shelters: ShelterWithRoute[],
  position: UserPosition,
  width: number,
  height: number,
): Projection {
  const pad = 26;
  const lngs: number[] = [position.longitude];
  const lats: number[] = [position.latitude];

  for (const z of zones) {
    for (const [lng, lat] of z.polygon) {
      lngs.push(lng);
      lats.push(lat);
    }
  }
  for (const s of shelters) {
    lngs.push(s.longitude);
    lats.push(s.latitude);
  }

  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);

  // One scale for both axes, so distances stay comparable across the map.
  const scale = Math.min(
    (width - pad * 2) / spanX,
    (height - pad * 2) / spanY,
  );

  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;

  const project = ((lng: number, lat: number) => ({
    x: offsetX + (lng - minLng) * kx * scale,
    // SVG y grows downward; latitude grows north. Invert or the city is upside down.
    y: offsetY + (maxLat - lat) * scale,
  })) as Projection;

  // One degree of latitude is ~111_320 m. Used to size the GPS accuracy ring.
  project.metresPerPixel = 111_320 / scale;

  return project;
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
 * A faint graticule. Gives the eye something to measure against so the shapes
 * read as places rather than as abstract blobs, without pretending to be streets.
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

/** The zone's own name, set inside it. A legend you have to cross-reference is a legend nobody reads. */
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

  return (
    <SvgText
      x={cx}
      y={cy}
      fill={colors.paper}
      fontSize={10}
      fontWeight="700"
      textAnchor="middle"
    >
      {zone.name.toUpperCase()}
    </SvgText>
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
