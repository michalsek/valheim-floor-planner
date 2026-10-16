/**
 * The planar graph of all wall runs: every segment is split where another wall
 * touches or crosses it, and overlapping pieces of wall become one edge with several
 * owners. Rooms are the faces of this graph (see `faces.ts`, `rooms.ts`).
 * Orthogonal segments only; diagonal ones are skipped with a warning.
 */
import type { WallFamily } from '../catalog/wallFamilies';

import { EPS, normalizeRun, segments, type Segment } from './geometry/polyline';
import type { PlanWarning, Vec2, WallId, WallRun, WallSide } from './types';

/** How far a wall reaches to each side of its drawn line, looking along it. */
export interface WallExtents {
  left: number;
  right: number;
}

/** Panel walls are centred on the line; a block wall's strip lies wholly on `side`. */
export const wallExtents = (side: WallSide, family: WallFamily): WallExtents => {
  const t = family.thickness;
  if (family.snapKind === 'centerline') return { left: t / 2, right: t / 2 };
  return side === 'right' ? { left: 0, right: t } : { left: t, right: 0 };
};

/** A vertex's coordinates, as `${x},${z}` after snapping (see `snapCoordinates`). */
export type VertexKey = string;

const vertexKey = (p: Vec2): VertexKey => `${p.x},${p.z}`;

/** One run segment's share of an edge; `left`/`right` are relative to the edge's a→b. */
interface EdgeOwner extends WallExtents {
  wallId: WallId;
  segment: number;
}

/** A piece of wall between two graph vertices, directed from the smaller key. */
export interface GraphEdge extends WallExtents {
  id: string;
  a: VertexKey;
  b: VertexKey;
  length: number;
  owners: EdgeOwner[];
}

export interface WallGraph {
  vertices: Map<VertexKey, Vec2>;
  edges: GraphEdge[];
  /** Segments left out of the graph (diagonals). */
  skipped: PlanWarning[];
}

interface Source {
  seg: Segment;
  horizontal: boolean;
  owner: EdgeOwner;
  /** Points where the segment is cut: its ends plus every junction. */
  cuts: Vec2[];
}

const onRange = (v: number, a: number, b: number): boolean =>
  v >= Math.min(a, b) && v <= Math.max(a, b);

/** Adds the junctions between two segments to both cut lists. */
const addJunctions = (s: Source, t: Source): void => {
  if (s.horizontal === t.horizontal) {
    const across = s.horizontal ? 'z' : 'x';
    const along = s.horizontal ? 'x' : 'z';
    if (s.seg.a[across] !== t.seg.a[across]) return;
    for (const p of [t.seg.a, t.seg.b]) {
      if (onRange(p[along], s.seg.a[along], s.seg.b[along])) s.cuts.push(p);
    }
    for (const p of [s.seg.a, s.seg.b]) {
      if (onRange(p[along], t.seg.a[along], t.seg.b[along])) t.cuts.push(p);
    }
    return;
  }
  const h = s.horizontal ? s : t;
  const v = s.horizontal ? t : s;
  const p = { x: v.seg.a.x, z: h.seg.a.z };
  if (onRange(p.x, h.seg.a.x, h.seg.b.x) && onRange(p.z, v.seg.a.z, v.seg.b.z)) {
    h.cuts.push(p);
    v.cuts.push(p);
  }
};

/**
 * Maps every value to the first of its run of values less than EPS apart, so points
 * that are "the same" within EPS get identical coordinates and can be compared
 * exactly from here on.
 */
const snapValues = (values: readonly number[]): Map<number, number> => {
  const snapped = new Map<number, number>();
  let rep = Number.NaN;
  let prev = Number.NaN;
  for (const v of [...new Set(values)].sort((a, b) => a - b)) {
    if (!(v - prev < EPS)) rep = v;
    snapped.set(v, rep);
    prev = v;
  }
  return snapped;
};

const snapCoordinates = (runs: readonly WallRun[]): ((p: Vec2) => Vec2) => {
  const points = runs.flatMap((run) => run.points);
  const xs = snapValues(points.map((p) => p.x));
  const zs = snapValues(points.map((p) => p.z));
  return (p) => ({ x: xs.get(p.x)!, z: zs.get(p.z)! });
};

const sources = (
  walls: Record<WallId, WallRun>,
  families: ReadonlyMap<string, WallFamily>,
  skipped: PlanWarning[]
): Source[] => {
  const runs = Object.values(walls);
  const snap = snapCoordinates(runs);
  return runs.flatMap((run) => {
    const family = families.get(run.familyId);
    // An unknown family is already reported by `derivePlan`.
    if (!family) return [];
    const extents = wallExtents(run.side, family);
    const points = normalizeRun(run.points.map(snap), run.closed);
    return segments(points, run.closed && points.length > 2).flatMap((seg, segment) => {
      const horizontal = seg.a.z === seg.b.z;
      if (seg.length < EPS) return [];
      if (!horizontal && seg.a.x !== seg.b.x) {
        skipped.push({
          wallId: run.id,
          segment,
          message: `Segment ${segment + 1} is diagonal, so rooms ignore it`,
        });
        return [];
      }
      const owner = { wallId: run.id, segment, ...extents };
      return [{ seg, horizontal, owner, cuts: [seg.a, seg.b] }];
    });
  });
};

export const buildWallGraph = (
  walls: Record<WallId, WallRun>,
  families: ReadonlyMap<string, WallFamily>
): WallGraph => {
  const skipped: PlanWarning[] = [];
  const all = sources(walls, families, skipped);
  all.forEach((s, i) => all.slice(i + 1).forEach((t) => addJunctions(s, t)));

  const vertices = new Map<VertexKey, Vec2>();
  const edges = new Map<string, GraphEdge>();
  const keyOf = (p: Vec2): VertexKey => {
    const key = vertexKey(p);
    if (!vertices.has(key)) vertices.set(key, p);
    return key;
  };

  for (const { seg, owner, cuts } of all) {
    const along = (p: Vec2) => (p.x - seg.a.x) * seg.dir.x + (p.z - seg.a.z) * seg.dir.z;
    const sorted = [...cuts].sort((p, q) => along(p) - along(q));
    const stops = sorted.filter((p, i) => i === 0 || vertexKey(p) !== vertexKey(sorted[i - 1]!));
    stops.slice(1).forEach((q, i) => {
      const p = stops[i]!;
      const kp = keyOf(p);
      const kq = keyOf(q);
      if (kp === kq) return;
      const forward = kp < kq;
      const own: EdgeOwner = forward ? owner : { ...owner, left: owner.right, right: owner.left };
      const [a, b] = forward ? [kp, kq] : [kq, kp];
      const id = `${a}|${b}`;
      const edge = edges.get(id);
      if (edge) {
        edge.owners.push(own);
        edge.left = Math.max(edge.left, own.left);
        edge.right = Math.max(edge.right, own.right);
      } else {
        const length = Math.hypot(q.x - p.x, q.z - p.z);
        edges.set(id, { id, a, b, length, owners: [own], left: own.left, right: own.right });
      }
    });
  }

  return { vertices, edges: [...edges.values()], skipped };
};

/**
 * Walls drawn over each other: each later owner of a shared edge gets a warning
 * (summed per segment), since both runs are split into pieces.
 */
export const overlapWarnings = (graph: WallGraph): PlanWarning[] => {
  const overlaps = new Map<string, { owner: EdgeOwner; length: number }>();
  for (const edge of graph.edges) {
    for (const owner of edge.owners.slice(1)) {
      const key = `${owner.wallId}:${owner.segment}`;
      const entry = overlaps.get(key) ?? { owner, length: 0 };
      entry.length += edge.length;
      overlaps.set(key, entry);
    }
  }
  return [...overlaps.values()].map(({ owner, length }) => ({
    wallId: owner.wallId,
    segment: owner.segment,
    message: `Segment ${owner.segment + 1} overlaps another wall for ${length.toFixed(2)} m: pieces counted twice`,
  }));
};
