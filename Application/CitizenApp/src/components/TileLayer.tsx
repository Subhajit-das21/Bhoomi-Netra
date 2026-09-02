import React, { useMemo, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { visibleTiles } from '../domain/mercator';
import { colors } from '../theme/tokens';
import type { MapCamera, TileRef, Viewport } from '../domain/mercator';

/**
 * The street map underneath everything else.
 *
 * XYZ raster tiles fetched as ordinary React Native `<Image>` views, absolutely
 * positioned, sitting beneath the `<Svg>` that draws zones, shelters and the user.
 * No native map module, no API key, no development build — it runs in Expo Go,
 * which is the difference between this shipping and not.
 *
 * `<Image>` rather than `Svg.Image` deliberately. react-native-svg does accept a
 * remote href, but core `<Image>` gives an `onError` hook, reuses the platform
 * image cache for free, and is certain to work on both platforms. When you cannot
 * see a rendered frame while building, certain beats elegant.
 */

/**
 * Tile source. A URL template with `{z}/{x}/{y}`, optionally `{s}` for a
 * subdomain. Read as a static property access because that is the only form
 * Expo's env transform recognises — see .env.example.
 */
const TILE_URL =
  process.env.EXPO_PUBLIC_TILE_URL ??
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';

/** Kept next to the URL so the credit cannot drift away from the source it credits. */
export const TILE_ATTRIBUTION =
  process.env.EXPO_PUBLIC_TILE_ATTRIBUTION ?? 'OpenStreetMap, CARTO';

/**
 * A template with no `{z}` in it is not a tile source. Setting
 * `EXPO_PUBLIC_TILE_URL=` to an empty string is therefore a supported way to say
 * "no basemap" — useful for a low-data build, or a demo with no network.
 */
export const isTileSourceConfigured = TILE_URL.includes('{z}');

const SUBDOMAINS = ['a', 'b', 'c', 'd'];

/**
 * How far the basemap is pushed back.
 *
 * The streets are here to answer "which lane do I turn down", not to be looked
 * at. Everything this screen is actually about — the hazard fill, the shelter,
 * you — is drawn on top, and a basemap at full strength competes with all three.
 *
 * This is the one number in Phase 1 that wants a real screen: too high and the
 * street names go, too low and the map reads as a road atlas with warnings on it.
 */
const SCRIM_OPACITY = 0.3;

/** Failed loads before we admit there is no basemap. One dead tile is a dead tile. */
const FAILURE_THRESHOLD = 3;

/**
 * `pending` is not a loading spinner. It is "we have asked, and until a tile
 * arrives the map is drawing its own graticule" — a state with a real map in it,
 * not a state with a wait in it.
 */
export type BasemapStatus = 'pending' | 'ready' | 'unavailable';

interface TileLayerProps {
  camera: MapCamera;
  viewport: Viewport;
  /** First tile on screen. The map drops its stand-in graticule at this point. */
  onReady?: () => void;
  /**
   * Called once when the basemap is clearly not coming. The screen says so out
   * loud rather than leaving a plausible-looking empty map: this app's whole
   * contract is that a blank map means "we do not know", never "you are clear".
   */
  onUnavailable?: () => void;
}

export default function TileLayer({
  camera,
  viewport,
  onReady,
  onUnavailable,
}: TileLayerProps) {
  const tiles = useMemo(
    () => visibleTiles(camera, viewport),
    [camera, viewport],
  );

  const [dead, setDead] = useState(false);
  const errors = useRef(0);
  const loaded = useRef(false);
  const reported = useRef(false);

  const onTileLoad = () => {
    if (loaded.current) return;
    loaded.current = true;
    onReady?.();
  };

  const onTileError = () => {
    errors.current += 1;
    if (loaded.current || reported.current) return;
    if (errors.current < FAILURE_THRESHOLD) return;
    reported.current = true;
    setDead(true);
    onUnavailable?.();
  };

  // Either there is no source configured, or the source is not answering. Both
  // mean the map falls back to its own graticule, which is exactly the map this
  // app had before tiles existed. There is no separate "tiles broken" layout to
  // design, and no half-loaded state to look at.
  if (!isTileSourceConfigured || dead) return null;

  return (
    <View
      // Taps belong to the marks above and the pan gesture around it.
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: viewport.width,
        height: viewport.height,
        overflow: 'hidden',
      }}
    >
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tileUri(tile) }}
          onLoad={onTileLoad}
          onError={onTileError}
          // Android fades images in by default, which turns a pan into a dozen
          // tiles blinking on at slightly different times.
          fadeDuration={0}
          style={{
            position: 'absolute',
            left: tile.left,
            top: tile.top,
            width: tile.size,
            height: tile.size,
          }}
        />
      ))}

      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: viewport.width,
          height: viewport.height,
          backgroundColor: colors.night,
          opacity: SCRIM_OPACITY,
        }}
      />
    </View>
  );
}

/**
 * Fill the template. `{r}` is a retina marker some providers use; we serve plain
 * 256 px tiles, so it collapses to nothing rather than being left in the URL as a
 * literal brace and guaranteeing a 404.
 *
 * The subdomain is picked from the tile's own coordinates, not at random, so the
 * same tile always resolves to the same host and stays cached across a pan.
 */
function tileUri(tile: TileRef): string {
  return TILE_URL.replace('{s}', SUBDOMAINS[(tile.x + tile.y) % SUBDOMAINS.length])
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y))
    .replace('{r}', '');
}
