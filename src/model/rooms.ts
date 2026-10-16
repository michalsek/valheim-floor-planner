/**
 * Rooms and buildings from the wall graph, with exact orthogonal region maths:
 * - a room is a bounded face, and its clear floor is the face minus the space every
 *   wall takes up (`wallSolid.ts`), so it can have several pieces;
 * - its outer size is the face plus the strips of the walls around it (a wall
 *   shared with another room counts in full);
 * - a component's outer boundary is either a hole in a room of another component
 *   (a room inside a room, a free-standing wall) or, if it encloses a room, the
 *   outline of a building: everything inside it plus its walls.
 */
import { labelSpot, type LabelSpot } from './geometry/labelSpot';
import { EPS } from './geometry/polyline';
import {
  regionArea,
  regionBox,
  regionFromRects,
  regionFromRings,
  regionRings,
  subtract,
  union,
  type Region,
} from './geometry/region';
import {
  isAxisRect,
  pointInRing,
  ringArea,
  ringBox,
  simplifyRing,
  type Box,
  type Ring,
} from './geometry/rings';
import { components, traceFaces, type Face, type HalfEdge } from './faces';
import { roofSpan, type RoofSpan } from './roof';
import type { GraphEdge, VertexKey, WallGraph } from './wallGraph';
import { wallRects } from './wallSolid';

export interface Room {
  /** Stable while the room's walls don't move. */
  key: string;
  /** The drawn lines around the room (stubs reaching into it removed). */
  grid: Ring;
  holes: Ring[];
  /**
   * Outlines of the floor between the walls' faces: pieces clockwise, holes
   * anticlockwise. Empty when the walls fill the room.
   */
  clear: Ring[];
  gridBox: Box;
  /** Bounds of all clear pieces; null when there is no clear floor. */
  clearBox: Box | null;
  outerBox: Box;
  gridArea: number;
  clearArea: number;
  /** Each outline is one axis-aligned rectangle (its box is its exact size). */
  gridIsRect: boolean;
  clearIsRect: boolean;
  outerIsRect: boolean;
  /**
   * The grid outline is a rectangle with no holes. Stubs reaching in from its walls
   * don't count: they shrink the clear floor but not the roofed span.
   */
  rectangular: boolean;
  labelSpot: LabelSpot;
  /** Rectangular rooms only. */
  roof: RoofSpan | null;
}

export interface Building {
  /** Outer faces of the walls; a courtyard open to the outside is a notch, not a hole. */
  outline: Ring[];
  footprintArea: number;
}

export interface PlanSummary {
  roomCount: number;
  gridArea: number;
  clearArea: number;
  footprintArea: number;
}

export interface RoomsResult {
  rooms: Room[];
  buildings: Building[];
  summary: PlanSummary;
}

const sum = (values: readonly number[]): number => values.reduce((s, v) => s + v, 0);

/** Drops filaments (a wall walked out and straight back) from a face's boundary. */
const withoutFilaments = (halfEdges: readonly HalfEdge[]): HalfEdge[] => {
  const isTwin = (h: HalfEdge, k: HalfEdge) => h.edgeId === k.edgeId && h.from === k.to;
  const stack: HalfEdge[] = [];
  for (const h of halfEdges) {
    if (stack.length > 0 && isTwin(stack.at(-1)!, h)) stack.pop();
    else stack.push(h);
  }
  while (stack.length > 1 && isTwin(stack.at(-1)!, stack[0]!)) {
    stack.pop();
    stack.shift();
  }
  return stack;
};

const minKey = (halfEdges: readonly HalfEdge[]): string =>
  halfEdges.map((h) => `${h.from}>${h.to}`).reduce((a, b) => (b < a ? b : a));

const isSingleRect = (rings: readonly Ring[]): boolean =>
  rings.length === 1 && isAxisRect(rings[0]!);

interface Context {
  graph: WallGraph;
  edgeById: Map<string, GraphEdge>;
  componentOf: Map<VertexKey, number>;
  /** Everything every wall takes up. */
  solid: Region;
}

const toRoom = (face: Face, holeFaces: readonly Face[], ctx: Context): Room => {
  const pos = (key: VertexKey) => ctx.graph.vertices.get(key)!;
  const boundary = withoutFilaments(face.halfEdges);
  const grid = simplifyRing(boundary.map((h) => pos(h.from)));
  const holes = holeFaces.map((h) => simplifyRing(h.ring));

  const floor = regionFromRings([face.ring, ...holeFaces.map((h) => h.ring)]);
  const clearRegion = subtract(floor, ctx.solid);
  const clearArea = regionArea(clearRegion);
  const hasClear = clearArea > EPS;
  const clear = hasClear ? regionRings(clearRegion) : [];

  const boundaryEdges = boundary.map((h) => ctx.edgeById.get(h.edgeId)!);
  const outer = union(
    regionFromRings([grid]),
    regionFromRects(wallRects(ctx.graph, boundaryEdges))
  );

  const gridBox = ringBox(grid);
  const gridIsRect = isAxisRect(grid);
  const rectangular = gridIsRect && holes.length === 0;
  return {
    key: minKey(face.halfEdges),
    grid,
    holes,
    clear,
    gridBox,
    clearBox: hasClear ? regionBox(clearRegion) : null,
    outerBox: regionBox(outer) ?? gridBox,
    gridArea: ringArea(grid) - sum(holes.map(ringArea)),
    clearArea: hasClear ? clearArea : 0,
    gridIsRect,
    clearIsRect: isSingleRect(clear),
    outerIsRect: isSingleRect(regionRings(outer)),
    rectangular,
    labelSpot: labelSpot(hasClear ? clearRegion : floor) ?? {
      center: grid[0] ?? { x: 0, z: 0 },
      w: 0,
      d: 0,
    },
    roof: rectangular ? roofSpan(gridBox.w, gridBox.d) : null,
  };
};

const toBuilding = (outerFace: Face, ctx: Context): Building => {
  const edges = ctx.graph.edges.filter((e) => ctx.componentOf.get(e.a) === outerFace.component);
  const region = union(
    regionFromRings([outerFace.ring]),
    regionFromRects(wallRects(ctx.graph, edges))
  );
  return { outline: regionRings(region), footprintArea: regionArea(region) };
};

export const findRooms = (graph: WallGraph): RoomsResult => {
  const faces = traceFaces(graph);
  const roomFaces = faces.filter((f) => f.area > EPS);
  const outerFaces = faces.filter((f) => f.area <= EPS);
  const ctx: Context = {
    graph,
    edgeById: new Map(graph.edges.map((e) => [e.id, e])),
    componentOf: components(graph),
    solid: regionFromRects(wallRects(graph, graph.edges)),
  };

  // Each outer boundary goes to the smallest room of another component around it.
  const holesOf = new Map<Face, Face[]>();
  const buildingFaces: Face[] = [];
  for (const outer of outerFaces) {
    const probe = outer.ring[0]!;
    const host = roomFaces
      .filter((r) => r.component !== outer.component && pointInRing(probe, r.ring))
      .reduce<Face | null>((best, r) => (!best || r.area < best.area ? r : best), null);
    if (host) holesOf.set(host, [...(holesOf.get(host) ?? []), outer]);
    else buildingFaces.push(outer);
  }

  const rooms = roomFaces.map((face) => toRoom(face, holesOf.get(face) ?? [], ctx));
  // Only enclosures are buildings: a free-standing wall or an open U has no footprint.
  const enclosing = new Set(roomFaces.map((f) => f.component));
  const buildings = buildingFaces
    .filter((f) => enclosing.has(f.component))
    .map((face) => toBuilding(face, ctx));

  return {
    rooms,
    buildings,
    summary: {
      roomCount: rooms.length,
      gridArea: sum(rooms.map((r) => r.gridArea)),
      clearArea: sum(rooms.map((r) => r.clearArea)),
      footprintArea: sum(buildings.map((b) => b.footprintArea)),
    },
  };
};
