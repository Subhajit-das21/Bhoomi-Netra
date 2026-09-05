/**
 * Evacuation routing over whatever road centrelines the basemap gave us.
 *
 * Blocked segments are not deleted from the graph, they are made expensive.
 * A route that has to cross 80 m of flooded carriageway is worth showing with
 * that fact attached; silently reporting "no route" would be worse than useless
 * to somebody who has to move people anyway.
 */

const SPEED_MS = {
  motorway: 16.7, trunk: 13.9, primary: 11.1, secondary: 8.3,
  tertiary: 6.9, street: 5.6, residential: 5.6, service: 4.2, path: 1.4,
};

const BLOCKED_PENALTY = 30;

/** Snap to ~3 m so line fragments from adjacent basemap tiles rejoin. */
const keyOf = (lon, lat) => `${Math.round(lon * 33000)}:${Math.round(lat * 33000)}`;

export function buildRoadGraph(grid, roads) {
  const nodeIndex = new Map();
  const nodes = [];
  const adj = [];
  const mx = 111320 * Math.cos((grid.centerLat * Math.PI) / 180);

  const nodeFor = (lon, lat) => {
    const k = keyOf(lon, lat);
    let id = nodeIndex.get(k);
    if (id === undefined) {
      id = nodes.length;
      nodeIndex.set(k, id);
      nodes.push([lon, lat]);
      adj.push([]);
    }
    return id;
  };

  for (let r = 0; r < roads.length; r++) {
    const road = roads[r];
    const speed = SPEED_MS[road.cls] ?? 5.0;
    for (let i = 1; i < road.coords.length; i++) {
      const [alon, alat] = road.coords[i - 1];
      const [blon, blat] = road.coords[i];
      const lengthM = Math.hypot((blon - alon) * mx, (blat - alat) * 110574);
      if (lengthM < 0.5) continue;
      const a = nodeFor(alon, alat);
      const b = nodeFor(blon, blat);
      if (a === b) continue;
      const midLon = (alon + blon) / 2;
      const midLat = (alat + blat) / 2;
      const gx = grid.xOf(midLon);
      const gy = grid.yOf(midLat);
      const gi = gx >= 0 && gy >= 0 && gx < grid.size && gy < grid.size ? gy * grid.size + gx : -1;
      const edge = { lengthM, seconds: lengthM / speed, gi, roadIdx: r };
      adj[a].push({ to: b, ...edge });
      adj[b].push({ to: a, ...edge });
    }
  }
  return { nodes, adj, mx };
}

/** Nearest graph node to a point, brute force — the graphs here are small. */
function nearestNode(graph, lon, lat) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = Math.hypot((graph.nodes[i][0] - lon) * graph.mx, (graph.nodes[i][1] - lat) * 110574);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return { id: best, distanceM: bestD };
}

/** Dijkstra with a binary heap; blocked edges cost 30× instead of being cut. */
function dijkstra(graph, source, isBlocked) {
  const n = graph.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const blockedM = new Float64Array(n);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  const heapV = [];
  const heapK = [];

  const push = (k, v) => {
    heapK.push(k);
    heapV.push(v);
    let i = heapK.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapK[p] <= heapK[i]) break;
      [heapK[p], heapK[i]] = [heapK[i], heapK[p]];
      [heapV[p], heapV[i]] = [heapV[i], heapV[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heapV[0];
    const lastK = heapK.pop();
    const lastV = heapV.pop();
    if (heapK.length) {
      heapK[0] = lastK;
      heapV[0] = lastV;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heapK.length && heapK[l] < heapK[m]) m = l;
        if (r < heapK.length && heapK[r] < heapK[m]) m = r;
        if (m === i) break;
        [heapK[m], heapK[i]] = [heapK[i], heapK[m]];
        [heapV[m], heapV[i]] = [heapV[i], heapV[m]];
        i = m;
      }
    }
    return top;
  };

  dist[source] = 0;
  push(0, source);
  while (heapK.length) {
    const u = pop();
    if (done[u]) continue;
    done[u] = 1;
    for (const e of graph.adj[u]) {
      if (done[e.to]) continue;
      const blocked = isBlocked(e);
      const cost = e.seconds * (blocked ? BLOCKED_PENALTY : 1);
      const nd = dist[u] + cost;
      if (nd < dist[e.to]) {
        dist[e.to] = nd;
        prev[e.to] = u;
        blockedM[e.to] = blockedM[u] + (blocked ? e.lengthM : 0);
        push(nd, e.to);
      }
    }
  }
  return { dist, prev, blockedM };
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const bearingOf = (from, to, mx) => {
  const deg = (Math.atan2((to[0] - from[0]) * mx, (to[1] - from[1]) * 110574) * 180) / Math.PI;
  return (deg + 360) % 360;
};

/**
 * Plan up to `maxCorridors` escape routes from the incident.
 *
 * Preference order: a mapped shelter or hospital that is out of the hazard, then
 * any clear road node far enough away. Routes are spread across compass sectors
 * so we do not hand three variations of the same street back to the operator.
 */
export function planEvacuation({ grid, graph, origin, isBlocked, isSafeCell, shelters = [], maxCorridors = 3 }) {
  if (!graph.nodes.length) return { corridors: [], note: 'No road centrelines loaded for this area' };
  const src = nearestNode(graph, origin[0], origin[1]);
  if (src.id < 0) return { corridors: [], note: 'No road within reach of the incident' };

  const { dist, prev, blockedM } = dijkstra(graph, src.id, isBlocked);

  const candidates = [];
  for (const s of shelters) {
    const nn = nearestNode(graph, s.lon, s.lat);
    if (nn.id < 0 || !Number.isFinite(dist[nn.id])) continue;
    if (!isSafeCell(s.gi)) continue;
    candidates.push({ node: nn.id, name: s.name || s.kindLabel || 'Shelter', kind: s.kind, seconds: dist[nn.id], anchor: [s.lon, s.lat] });
  }

  if (candidates.length < maxCorridors) {
    const minEscapeM = grid.radiusKm * 1000 * 0.55;
    for (let i = 0; i < graph.nodes.length; i++) {
      if (!Number.isFinite(dist[i])) continue;
      const [lon, lat] = graph.nodes[i];
      const gx = grid.xOf(lon);
      const gy = grid.yOf(lat);
      const gi = gx >= 0 && gy >= 0 && gx < grid.size && gy < grid.size ? gy * grid.size + gx : -1;
      if (!isSafeCell(gi)) continue;
      const away = Math.hypot((lon - origin[0]) * graph.mx, (lat - origin[1]) * 110574);
      if (away < minEscapeM) continue;
      candidates.push({ node: i, name: 'Clear ground', kind: 'exit', seconds: dist[i], anchor: [lon, lat] });
    }
  }

  candidates.sort((a, b) => a.seconds - b.seconds);
  const corridors = [];
  const usedSectors = new Set();
  for (const c of candidates) {
    if (corridors.length >= maxCorridors) break;
    const bearing = bearingOf(graph.nodes[src.id], c.anchor, graph.mx);
    const sector = Math.round(bearing / 45) % 8;
    if (usedSectors.has(sector)) continue;
    const path = [];
    let cur = c.node;
    let guard = 0;
    while (cur !== -1 && guard++ < graph.nodes.length) {
      path.push(graph.nodes[cur]);
      if (cur === src.id) break;
      cur = prev[cur];
    }
    if (path.length < 2) continue;
    path.reverse();
    let meters = 0;
    for (let i = 1; i < path.length; i++) {
      meters += Math.hypot((path[i][0] - path[i - 1][0]) * graph.mx, (path[i][1] - path[i - 1][1]) * 110574);
    }
    usedSectors.add(sector);
    corridors.push({
      path,
      target: c.name,
      kind: c.kind,
      bearing,
      compass: COMPASS[sector],
      meters,
      driveSeconds: c.seconds,
      walkSeconds: meters / 1.25,
      compromisedMeters: blockedM[c.node],
    });
  }

  return {
    corridors,
    originOffsetM: src.distanceM,
    note: corridors.length ? null : 'Every road out of this area is inside the hazard footprint',
  };
}
