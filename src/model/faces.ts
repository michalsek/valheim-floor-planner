/**
 * Face traversal of the orthogonal wall graph. Each edge gives two half-edges; a
 * face keeps its interior on the right of its half-edges, so a bounded face runs
 * clockwise on screen (positive `signedArea`) and a component's outer boundary runs
 * anticlockwise (negative, or zero for a tree of filaments).
 */
import { signedArea } from './geometry/polyline';
import type { Ring } from './geometry/rings';
import type { Vec2 } from './types';
import type { GraphEdge, VertexKey, WallGraph } from './wallGraph';

export interface HalfEdge {
  from: VertexKey;
  to: VertexKey;
  edgeId: string;
  /** How far the wall reaches into this half-edge's face. */
  right: number;
  /** How far it reaches into the face on the other side. */
  left: number;
}

export interface Face {
  halfEdges: HalfEdge[];
  ring: Ring;
  area: number;
  component: number;
}

/** Direction slots, rising with the clockwise screen angle: +x, +z, −x, −z. */
const slotOf = (from: Vec2, to: Vec2): number => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? 0 : 2;
  return dz > 0 ? 1 : 3;
};

const twin = (h: HalfEdge): HalfEdge => ({
  from: h.to,
  to: h.from,
  edgeId: h.edgeId,
  right: h.left,
  left: h.right,
});

const halfEdgesOf = (edge: GraphEdge): [HalfEdge, HalfEdge] => {
  const forward = { from: edge.a, to: edge.b, edgeId: edge.id, right: edge.right, left: edge.left };
  return [forward, twin(forward)];
};

/** Connected components of the graph, as a vertex → component index map. */
export const components = (graph: WallGraph): Map<VertexKey, number> => {
  const parent = new Map<VertexKey, VertexKey>();
  const find = (k: VertexKey): VertexKey => {
    const p = parent.get(k) ?? k;
    if (p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  for (const edge of graph.edges) parent.set(find(edge.a), find(edge.b));

  const index = new Map<VertexKey, number>();
  const roots = new Map<VertexKey, number>();
  for (const key of graph.vertices.keys()) {
    const root = find(key);
    if (!roots.has(root)) roots.set(root, roots.size);
    index.set(key, roots.get(root)!);
  }
  return index;
};

export const traceFaces = (graph: WallGraph): Face[] => {
  const pos = (k: VertexKey): Vec2 => graph.vertices.get(k)!;
  const halfEdges = graph.edges.flatMap(halfEdgesOf);
  const outgoing = new Map<VertexKey, (number | undefined)[]>();
  halfEdges.forEach((h, i) => {
    const slots = outgoing.get(h.from) ?? [];
    slots[slotOf(pos(h.from), pos(h.to))] = i;
    outgoing.set(h.from, slots);
  });

  /** The next half-edge round the face: the first turn to the right of coming back. */
  const next = (h: HalfEdge): number => {
    const slots = outgoing.get(h.to)!;
    const back = slotOf(pos(h.to), pos(h.from));
    for (let step = 1; step <= 4; step++) {
      const i = slots[(back - step + 4) % 4];
      if (i !== undefined) return i;
    }
    throw new Error('Half-edge has no way on');
  };

  const component = components(graph);
  const visited = new Set<number>();
  const faces: Face[] = [];
  halfEdges.forEach((_, start) => {
    if (visited.has(start)) return;
    const walk: HalfEdge[] = [];
    for (let i = start; !visited.has(i); i = next(halfEdges[i]!)) {
      visited.add(i);
      walk.push(halfEdges[i]!);
    }
    const ring = walk.map((h) => pos(h.from));
    faces.push({
      halfEdges: walk,
      ring,
      area: signedArea(ring),
      component: component.get(walk[0]!.from)!,
    });
  });
  return faces;
};
