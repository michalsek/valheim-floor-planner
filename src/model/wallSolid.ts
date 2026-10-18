/**
 * The space walls take up on the plan, as rectangles: one strip per graph edge (its
 * left and right reach), plus a box at each vertex that fills the corner where
 * perpendicular strips meet (the outer corner of an L, a block wall's corner column).
 */
import type { Rect } from './geometry/region';
import { round6 } from './geometry/round';
import type { Vec2 } from './types';
import type { GraphEdge, VertexKey, WallGraph } from './wallGraph';

/** The rectangle around `points`, on the 1e-6 m grid so strips of different walls line up. */
const box = (points: readonly Vec2[]): Rect => ({
  x0: round6(Math.min(...points.map((p) => p.x))),
  x1: round6(Math.max(...points.map((p) => p.x))),
  z0: round6(Math.min(...points.map((p) => p.z))),
  z1: round6(Math.max(...points.map((p) => p.z))),
});

/** Where an edge reaches across at one of its ends: its right and left faces. */
const crossSection = (graph: WallGraph, edge: GraphEdge, at: Vec2): Vec2[] => {
  const a = graph.vertices.get(edge.a)!;
  const b = graph.vertices.get(edge.b)!;
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  // Right normal of a→b: (−dz, dx).
  const n = { x: -(b.z - a.z) / length, z: (b.x - a.x) / length };
  return [
    { x: at.x + n.x * edge.right, z: at.z + n.z * edge.right },
    { x: at.x - n.x * edge.left, z: at.z - n.z * edge.left },
  ];
};

const strip = (graph: WallGraph, edge: GraphEdge): Rect =>
  box([
    ...crossSection(graph, edge, graph.vertices.get(edge.a)!),
    ...crossSection(graph, edge, graph.vertices.get(edge.b)!),
  ]);

/** The box spanned by every edge's cross-section at `key` (flat where none cross). */
const joint = (graph: WallGraph, key: VertexKey, edges: readonly GraphEdge[]): Rect => {
  const at = graph.vertices.get(key)!;
  return box([
    at,
    ...edges.filter((e) => e.a === key || e.b === key).flatMap((e) => crossSection(graph, e, at)),
  ]);
};

/** Strips of `edges` plus the joint boxes at their ends. */
export const wallRects = (graph: WallGraph, edges: readonly GraphEdge[]): Rect[] => {
  const keys = new Set(edges.flatMap((e) => [e.a, e.b]));
  return [
    ...edges.map((e) => strip(graph, e)),
    ...[...keys].map((key) => joint(graph, key, graph.edges)),
  ];
};
