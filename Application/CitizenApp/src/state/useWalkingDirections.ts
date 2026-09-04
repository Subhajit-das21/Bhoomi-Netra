import { useEffect, useState } from 'react';
import { routingConfigured, walkingRoute } from '../services/routing';
import { useCitizen } from './CitizenProvider';
import type { RoutePoint, RoutingFailure } from '../domain/routing';
import type { RouteStep, ShelterWithRoute } from '../domain/types';

/**
 * The best directions available for one shelter, and where they came from.
 *
 * ------------------------------------------------------------------
 * Surveyed first, always
 * ------------------------------------------------------------------
 * `shelter_routes` wins whenever it has an answer, and this does not reach the
 * network in that case. Those rows were written by somebody who walked the street:
 * 006_citizen_tables.sql carries a step that says cross at the footbridge rather
 * than the rail underpass because the underpass floods to the roof, and no road
 * graph in the world encodes that. A router is what we use where nobody has walked.
 *
 * ------------------------------------------------------------------
 * The fallback is the loading state
 * ------------------------------------------------------------------
 * There is no spinner here and no gate. While the request is in flight the screen
 * shows the compass bearing and the street address it would have shown anyway, and
 * real steps replace them if they arrive. That ordering is the whole design: the
 * person holding the phone is standing in water, and the worst thing this feature
 * could do is take away four true facts for six seconds in the hope of a fifth.
 *
 * A hook rather than provider state, because this is per-shelter and per-visit.
 * Folding it into the snapshot in CitizenProvider would mean routing to four
 * shelters on every refresh to answer a question about the one being walked to.
 */

export interface WalkingDirections {
  /** The steps to render, whatever wrote them. Empty when there are none. */
  steps: RouteStep[];
  /**
   * The line to draw on the map, in the order it is walked. Only ever populated
   * for a generated route: `shelter_routes` stores instructions, not geometry, so
   * a surveyed walk has real steps and no shape. The map draws a bearing for it,
   * which is what it has always done.
   */
  path: RoutePoint[];
  /** Who wrote the directions, or null when there are none to attribute. */
  source: 'surveyed' | 'generated' | null;
  /**
   * Why there are no generated steps: 'asking' while the request is in flight,
   * a `RoutingFailure` once it has answered, null when it was never needed.
   * `unconfigured` is not an error a citizen should be shown — it means this build
   * has no key — but 'no-path' very much is.
   */
  gap: RoutingFailure | 'asking' | null;
}

export function useWalkingDirections(
  shelter: ShelterWithRoute | null,
  surveyed: RouteStep[],
): WalkingDirections {
  const { position, zones } = useCitizen();
  const [gap, setGap] = useState<RoutingFailure | 'asking' | null>(null);
  const [generated, setGenerated] = useState<{
    forShelter: string;
    steps: RouteStep[];
    path: RoutePoint[];
  } | null>(null);

  const hasSurveyed = surveyed.length > 0;

  useEffect(() => {
    if (!shelter || hasSurveyed || !routingConfigured()) {
      setGap(null);
      setGenerated(null);
      return;
    }

    // An answer that arrives after the user has picked a different shelter is
    // directions to the wrong building. Dropped, not rendered.
    let live = true;
    setGenerated(null);
    setGap('asking');

    void walkingRoute(position, shelter, zones).then((result) => {
      if (!live) return;
      if (result.ok) {
        setGenerated({
          forShelter: shelter.id,
          steps: result.steps,
          path: result.path,
        });
        setGap(null);
      } else {
        setGap(result.reason);
      }
    });

    return () => {
      live = false;
    };
    // `zones` is in here on purpose rather than for completeness: the zones are the
    // exclusions, so a district that publishes a new flood polygon has invalidated
    // this route and the walk must be recomputed around it. Both this and `shelter`
    // keep their identity across the 30-second clock tick in CitizenProvider and
    // change only when a fetch actually returns something new.
  }, [shelter, hasSurveyed, position, zones]);

  if (hasSurveyed) {
    return { steps: surveyed, path: [], source: 'surveyed', gap: null };
  }
  // Guarded by id as well as by the `live` flag above. The flag covers an unmount;
  // this covers a re-render that swapped the shelter under a request already
  // resolved, which would otherwise draw one hall's path under another's name.
  if (generated && shelter && generated.forShelter === shelter.id) {
    return {
      steps: generated.steps,
      path: generated.path,
      source: 'generated',
      gap: null,
    };
  }
  return { steps: [], path: [], source: null, gap };
}
