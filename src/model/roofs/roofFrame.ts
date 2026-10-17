/**
 * A roof's shape on the plan, whatever it is made of: the eave ring (the outline grown
 * by the overhangs, then to whole 2 m cells), the cell lattice over it, and the run
 * field, metres of run from the eave up to a point. The roof rises `k` per metre of
 * run, so its height is `eaveY + k · run`. Pure.
 *
 * - Hip: run is the L∞ distance to the nearest eave edge. On an orthogonal ring that is
 *   its straight skeleton: hips at convex corners, valleys at re-entrant ones.
 * - Gable: the same, against the two eave edges along the ridge only.
 * - Shed: the distance from the low eave.
 *
 * Every piece covers 2 m of run, so a half-run (eave to ridge) of any whole number of
 * metres tiles: odd ones end in a ridge row, even ones meet at a seam. What has to be
 * whole is the number of 2 m cells across: a ring that isn't grows its far sides by
 * 1 m, which overhang that much more.
 */
import type { Roof, RoofSide, Vec2 } from '../types';
import { largestRing, offsetOrthoRing, regionFromRects, regionRings } from '../geometry/region';
import { pointInRing, ringArea, ringBox, type Ring } from '../geometry/rings';
import { EPS } from '../geometry/polyline';

/** A roof piece's size on the plan (metres). */
export const CELL = 2;

/** An edge of the eave ring that the roof slopes down to. */
export interface EaveEdge {
  a: Vec2;
  b: Vec2;
  /** Unit normal pointing out of the ring: downhill. */
  out: Vec2;
}

/** How the ring grew to whole cells. */
export type RoofGrowth =
  /** A rectangle: the far side across `axis` grew 1 m; `wallSpan` is the outline's size. */
  | { kind: 'span'; axis: 'x' | 'z'; wallSpan: number; along: boolean }
  /** An edge of another shape off the 2 m lattice. */
  | { kind: 'edge' };

export interface RoofFrame {
  /** The eave ring grown to whole cells (clockwise): where the pieces go. */
  ring: Ring;
  /** The lattice's first corner (the ring's minimum corner). */
  origin: Vec2;
  cols: number;
  rows: number;
  /** Metres of run from the eave at `p` (inside the ring). */
  run(p: Vec2): number;
  /** The run where the roof rests on its walls: the eave sits `k ·` this below their top. */
  restRun: number;
  /** The edges the roof slopes down to (not a gable's ends or a shed's high side). */
  eaves: EaveEdge[];
  growth: RoofGrowth[];
  /** The eave closed up a notch narrower than two eaves. */
  notchClosed: boolean;
}

export type RoofShapeParams = Pick<Roof, 'outline' | 'kind' | 'ridgeAxis' | 'lowSide' | 'overhang'>;

/** The axis a gable's or shed's eaves run along (a shed's: along its low side). */
export const eaveAxis = (roof: Pick<Roof, 'kind' | 'ridgeAxis' | 'lowSide'>): 'x' | 'z' =>
  roof.kind === 'shed' ? (roof.lowSide.endsWith('z') ? 'x' : 'z') : roof.ridgeAxis;

/** Distance from a box's `side` edge inwards, for points inside it. */
const fromSide = (box: { min: Vec2; max: Vec2 }, side: RoofSide, p: Vec2): number => {
  const axis = side.endsWith('x') ? 'x' : 'z';
  return side.startsWith('+') ? box.max[axis] - p[axis] : p[axis] - box.min[axis];
};

const edgesOf = (ring: readonly Vec2[]): { a: Vec2; b: Vec2 }[] =>
  ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! }));

/** Outward normal of an edge of a clockwise (on screen) ring. */
const outwardOf = ({ a, b }: { a: Vec2; b: Vec2 }): Vec2 => {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: (b.z - a.z) / length, z: -(b.x - a.x) / length };
};

/** L∞ distance from `p` to an axis-aligned segment. */
const chebyshevToSegment = (p: Vec2, { a, b }: { a: Vec2; b: Vec2 }): number => {
  const dx = Math.max(0, Math.min(a.x, b.x) - p.x, p.x - Math.max(a.x, b.x));
  const dz = Math.max(0, Math.min(a.z, b.z) - p.z, p.z - Math.max(a.z, b.z));
  return Math.max(dx, dz);
};

/** The outline grown by the overhangs: eaves on every side (hip), or eaves and gables. */
const eaveRing = (roof: RoofShapeParams): Ring => {
  const { eave, gable } = roof.overhang;
  if (roof.kind === 'hip') return offsetOrthoRing(roof.outline, eave);
  const { min, max } = ringBox(roof.outline);
  const gx = eaveAxis(roof) === 'x' ? gable : eave;
  const gz = eaveAxis(roof) === 'x' ? eave : gable;
  return [
    { x: min.x - gx, z: min.z - gz },
    { x: max.x + gx, z: min.z - gz },
    { x: max.x + gx, z: max.z + gz },
    { x: min.x - gx, z: max.z + gz },
  ];
};

/**
 * The ring made of every 2 m cell (from its minimum corner) that covers any of `ring`.
 * Its corners are on the 1 m grid, so a cell covers some of it exactly when one of its
 * four 1 m quarters' centres is inside.
 */
const snapToCells = (ring: Ring): Ring => {
  const { min, max } = ringBox(ring);
  const rects = [];
  for (let x = min.x; x < max.x - EPS; x += CELL) {
    for (let z = min.z; z < max.z - EPS; z += CELL) {
      const quarters = [0.5, 1.5].flatMap((u) => [0.5, 1.5].map((v) => ({ x: x + u, z: z + v })));
      if (quarters.some((q) => pointInRing(q, ring))) {
        rects.push({ x0: x, x1: x + CELL, z0: z, z1: z + CELL });
      }
    }
  }
  return largestRing(regionRings(regionFromRects(rects)));
};

const rectGrowth = (roof: RoofShapeParams, eave: Ring, snapped: Ring): RoofGrowth[] => {
  const before = ringBox(eave);
  const after = ringBox(snapped);
  const wall = ringBox(roof.outline);
  const across = roof.kind === 'hip' ? null : eaveAxis(roof) === 'x' ? 'z' : 'x';
  return (['x', 'z'] as const).flatMap((axis): RoofGrowth[] => {
    const size = axis === 'x' ? 'w' : 'd';
    if (after[size] - before[size] < EPS) return [];
    return [
      { kind: 'span', axis, wallSpan: wall[size], along: across !== null && axis !== across },
    ];
  });
};

/** The roof's frame on the plan (see the module comment). */
export const roofFrame = (roof: RoofShapeParams): RoofFrame => {
  const eave = eaveRing(roof);
  const ring = snapToCells(eave);
  const box = ringBox(ring);
  const growth: RoofGrowth[] =
    eave.length === 4 && ring.length === 4
      ? rectGrowth(roof, eave, ring)
      : ringArea(ring) - ringArea(eave) > EPS
        ? [{ kind: 'edge' }]
        : [];

  const edges = edgesOf(ring).map((e) => ({ ...e, out: outwardOf(e) }));
  const acrossZ = eaveAxis(roof) === 'x';
  const low = roof.lowSide;
  const eaves = edges.filter(({ out }) => {
    if (roof.kind === 'hip') return true;
    if (roof.kind === 'gable') return acrossZ ? Math.abs(out.z) > 0.5 : Math.abs(out.x) > 0.5;
    const outward = low.endsWith('x') ? out.x : out.z;
    return (low.startsWith('+') ? outward : -outward) > 0.5;
  });

  let run: (p: Vec2) => number;
  if (roof.kind === 'hip') {
    run = (p) => Math.min(...eaves.map((e) => chebyshevToSegment(p, e)));
  } else if (roof.kind === 'gable') {
    run = acrossZ
      ? (p) => Math.min(p.z - box.min.z, box.max.z - p.z)
      : (p) => Math.min(p.x - box.min.x, box.max.x - p.x);
  } else {
    run = (p) => fromSide(box, low, p);
  }

  // The roof rests on the near eave wall (a shed's low one); the near side never grows.
  const wall = ringBox(roof.outline);
  const restRun =
    roof.kind === 'shed'
      ? fromSide(box, low, low.startsWith('+') ? wall.max : wall.min)
      : roof.overhang.eave;

  return {
    ring,
    origin: box.min,
    cols: Math.round(box.w / CELL),
    rows: Math.round(box.d / CELL),
    run,
    restRun,
    eaves,
    growth,
    notchClosed: roof.kind === 'hip' && eave.length < roof.outline.length,
  };
};

/** Whether the cell's centre is inside the ring (every cell is wholly in or out). */
export const cellInside = (frame: RoofFrame, i: number, j: number): boolean =>
  pointInRing(cellCentre(frame, i, j), frame.ring);

export const cellCentre = (frame: Pick<RoofFrame, 'origin'>, i: number, j: number): Vec2 => ({
  x: frame.origin.x + CELL * i + CELL / 2,
  z: frame.origin.z + CELL * j + CELL / 2,
});
