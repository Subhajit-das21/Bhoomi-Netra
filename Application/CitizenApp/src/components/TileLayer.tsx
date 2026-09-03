import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { visibleTiles } from '../domain/mercator';
import { colors } from '../theme/tokens';
import type { MapCamera, TileRef, Viewport } from '../domain/mercator';

/**
 * The street map underneath everything else.
 *
 * XYZ raster tiles fetched as ordinary React Native `<Image>` views, absolutely
 * positioned, sitting beneath the `<Svg>` that draws zones, shelters and the user.
 * No native map module, no development build — it runs in Expo Go, which is the
 * difference between this shipping and not.
 *
 * `<Image>` rather than `Svg.Image` deliberately. react-native-svg does accept a
 * remote href, but core `<Image>` gives an `onError` hook, reuses the platform
 * image cache for free, and is certain to work on both platforms. When you cannot
 * see a rendered frame while building, certain beats elegant.
 */

/**
 * A basemap: one or more tile templates drawn in order, and the facts needed to
 * credit it and to decide how far to push it back.
 *
 * Two templates rather than one is how a proper cartographic basemap is built —
 * artwork underneath, place and street labels on top — and it is why this is a
 * list rather than a string. The label layer failing is survivable; the artwork
 * failing is not, so only the first template's load events steer the fallback.
 */
export interface TileSource {
  /** XYZ templates. `{z}/{x}/{y}` required, `{s}` and `{r}` optional. */
  urls: string[];
  /** Rendered in the credit line at the foot of the map. Not optional in law. */
  attribution: string;
  /**
   * Whether the artwork is dark or light. Not a taste setting: every mark on
   * this map is cream on a night ground, so a light basemap has to be pushed
   * much further back before a cream zone label can be read over it.
   */
  scheme: 'dark' | 'light';
}

/**
 * Overrides from `.env`. Static dot-notation because that is the only form
 * Expo's transform inlines — see .env.example, which also explains why a tile
 * API key in here is readable by anyone holding the APK.
 */
const ENV_URL = process.env.EXPO_PUBLIC_TILE_URL;
const ENV_ATTRIBUTION = process.env.EXPO_PUBLIC_TILE_ATTRIBUTION;
const ENV_SCHEME = process.env.EXPO_PUBLIC_TILE_SCHEME;

/**
 * The fallback chain, best first.
 *
 * Every source here needs no API key, because a safety app whose map is blank
 * until somebody registers for a developer account is a safety app with a blank
 * map. Carto's `dark_all` used to be the default and is not any more: Carto now
 * requires a key for raster basemaps and stamps "API KEY REQUIRED" diagonally
 * across every unauthenticated tile. It is still the nicest artwork of the three
 * — put a key in `EXPO_PUBLIC_TILE_URL` and it goes back to the front of this
 * chain, and the watermark goes away.
 *
 * A chain rather than a single source because I cannot reach a tile server from
 * where this was written, so "the one I picked works" was never a claim I could
 * make. One that does work will be found at runtime, and the credit line names
 * whichever it turns out to be.
 */
const DEFAULT_SOURCES: TileSource[] = [
  {
    // Esri's Dark Gray Canvas, in its two published halves. Drawn to sit under
    // data — muted greys, no saturated colour anywhere — which is exactly the
    // job here, and unlike a styled dark road map it does not fight a terracotta
    // hazard wash for attention.
    urls: [
      'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    ],
    // Note `{z}/{y}/{x}`: Esri orders row before column. `fillTemplate` is a
    // plain substitution, so template order is the only place this matters.
    attribution: 'Esri, HERE, Garmin, OpenStreetMap',
    scheme: 'dark',
  },
  {
    // The last resort, and the only one certain to answer: OSM's own tiles need
    // no key and have served the same URL shape for fifteen years. Light artwork
    // under a heavy scrim (see SCRIM below) — legible, not beautiful.
    //
    // OSM's tile usage policy does not permit app traffic at scale. Fine for a
    // demo and for the minutes after another provider drops; not fine shipped.
    urls: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: 'OpenStreetMap contributors',
    scheme: 'light',
  },
];

/**
 * The chain this build will actually use.
 *
 * A configured source goes in front rather than replacing the defaults, so a
 * mistyped key or an expired plan degrades to a working map instead of a blank
 * one. Setting `EXPO_PUBLIC_TILE_URL=` to an empty string is the one way to say
 * "no basemap at all" and is honoured absolutely — a legitimate choice for a
 * low-data build, and the credit line says so out loud.
 */
export const TILE_SOURCES: TileSource[] = buildChain();

function buildChain(): TileSource[] {
  if (ENV_URL === undefined) return DEFAULT_SOURCES;
  // A template with no `{z}` in it is not a tile source.
  if (!ENV_URL.includes('{z}')) return [];
  const urls = String(ENV_URL)
    .split('|')
    .map((u: string) => u.trim())
    .filter((u: string) => u.length > 0);
  if (urls.length === 0) return [];
  return [
    {
      urls,
      attribution: ENV_ATTRIBUTION ?? 'the configured tile source',
      // Assume dark, because every mark on this map is drawn for a dark ground
      // and assuming light would wash the whole basemap out for no reason.
      scheme: ENV_SCHEME === 'light' ? 'light' : 'dark',
    },
    ...DEFAULT_SOURCES,
  ];
}

export const isTileSourceConfigured = TILE_SOURCES.length > 0;

const SUBDOMAINS = ['a', 'b', 'c', 'd'];

/**
 * How far the basemap is pushed back.
 *
 * The streets are here to answer "which lane do I turn down", not to be looked
 * at. Everything this screen is actually about — the hazard fill, the shelter,
 * you — is drawn on top, and a basemap at full strength competes with all three.
 *
 * The light figure is much heavier because it is doing a second job: dragging a
 * daylight-coloured map down to where cream text can be read over it. It costs
 * the tiles' own baked-in labels some contrast, which is the price of having a
 * fallback that works at all rather than one that looks right.
 */
const SCRIM: Record<TileSource['scheme'], number> = { dark: 0.3, light: 0.62 };

/**
 * Failed loads before this source is written off. Counted per template, so a
 * two-layer source gets twice the rope — one dead tile is a dead tile, and a
 * whole dead provider is what we are actually looking for.
 */
const FAILURE_THRESHOLD = 3;

/**
 * `pending` is not a loading spinner. It is "we have asked, and until a tile
 * arrives the map is drawing its own graticule" — a state with a real map in it,
 * not a state with a wait in it.
 */
export type BasemapStatus = 'pending' | 'ready' | 'unavailable';

export interface BasemapState {
  status: BasemapStatus;
  /**
   * The source on screen, which after a fallback is not the one that was asked
   * for. Carried alongside the status because a credit that names the wrong
   * provider is a licence breach, quietly.
   */
  attribution: string;
}

export function initialBasemapState(): BasemapState {
  return {
    status: 'pending',
    attribution: TILE_SOURCES[0]?.attribution ?? '',
  };
}

interface TileLayerProps {
  camera: MapCamera;
  viewport: Viewport;
  /**
   * Fired when the basemap becomes ready, falls back, or gives up. The screen
   * owns this state because the screen is what has to explain an absence in the
   * credit line: this app's whole contract is that a blank map means "we do not
   * know", never "you are clear".
   */
  onState: (state: BasemapState) => void;
}

export default function TileLayer({ camera, viewport, onState }: TileLayerProps) {
  const tiles = useMemo(
    () => visibleTiles(camera, viewport),
    [camera, viewport],
  );

  /** Position in the chain. Only ever moves forward. */
  const [index, setIndex] = useState(0);
  const source = TILE_SOURCES[index];

  const errors = useRef(0);
  const loaded = useRef(false);

  // A new source starts with a clean slate, or the previous provider's failures
  // would immediately condemn its replacement.
  useEffect(() => {
    errors.current = 0;
    loaded.current = false;
  }, [index]);

  const onTileLoad = () => {
    if (loaded.current || !source) return;
    loaded.current = true;
    onState({ status: 'ready', attribution: source.attribution });
  };

  const onTileError = () => {
    if (loaded.current || !source) return;
    errors.current += 1;
    if (errors.current < FAILURE_THRESHOLD * source.urls.length) return;

    if (index + 1 < TILE_SOURCES.length) {
      setIndex(index + 1);
      return;
    }
    // Chain exhausted. The screen stops rendering this layer, which is the whole
    // of the fallback: the map returns to its own graticule, exactly as it was
    // before tiles existed, and every mark on it is still true.
    onState({ status: 'unavailable', attribution: '' });
  };

  // No source configured at all is a supported build, not a fault.
  if (!source) return null;

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
      {source.urls.map((template, layer) =>
        tiles.map((tile) => (
          <Image
            // The layer index is part of the key so the labels layer cannot be
            // recycled into the artwork layer's slot on a source change.
            key={`${index}:${layer}:${tile.key}`}
            source={{ uri: fillTemplate(template, tile) }}
            // Only the artwork steers the fallback. A missing labels layer leaves
            // a map you can still walk by; a missing artwork layer leaves nothing.
            onLoad={layer === 0 ? onTileLoad : undefined}
            onError={layer === 0 ? onTileError : undefined}
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
        )),
      )}

      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: viewport.width,
          height: viewport.height,
          backgroundColor: colors.night,
          opacity: SCRIM[source.scheme],
        }}
      />
    </View>
  );
}

/**
 * Fill a template for one tile.
 *
 * `{r}` is a retina marker some providers use; we serve plain 256 px tiles, so it
 * collapses to nothing rather than being left in the URL as a literal brace and
 * guaranteeing a 404.
 *
 * The subdomain is picked from the tile's own coordinates, not at random, so the
 * same tile always resolves to the same host and stays cached across a pan.
 *
 * Nothing here touches a query string, which is the reason adding `?key=...` to
 * a template is a `.env` edit and not a code change.
 */
function fillTemplate(template: string, tile: TileRef): string {
  return template
    .replace('{s}', SUBDOMAINS[(tile.x + tile.y) % SUBDOMAINS.length])
    .replace('{z}', String(tile.z))
    .replace('{x}', String(tile.x))
    .replace('{y}', String(tile.y))
    .replace('{r}', '');
}
