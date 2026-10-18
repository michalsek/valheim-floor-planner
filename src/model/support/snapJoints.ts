/**
 * Snap joints: two pieces with snap points within `SNAP_JOINT` of each other were
 * snapped together, so they touch for support even where their colliders only meet
 * along an edge (a ridge cap on two slopes, an arch on a wall's end). Passed to
 * `planSupport` as declared pairs, as `roofContacts` are. Pure.
 */
import { boxSnapPoints, type SnapLib } from '../build/snapPoints';
import type { PieceBox } from '../pieceBoxes';
import type { Vec3 } from '../types';

/** How close two pieces' snap points must be for a joint (metres). */
export const SNAP_JOINT = 0.03;
/** The hash's cell size (metres): over twice `SNAP_JOINT`, so a query spans ≤ 2 cells per axis. */
const CELL = 0.1;

/** Snap points hashed by position, each with the index of its box. */
export interface SnapJointIndex {
  /** Joined boxes, by `PieceBox.key`, each pair once. */
  pairs: readonly (readonly [string, string])[];
  cells: ReadonlyMap<string, readonly { box: number; p: Vec3 }[]>;
  lib: SnapLib;
}

const cellKey = (i: number, j: number, k: number) => `${i},${j},${k}`;

/** Every cell a point's `SNAP_JOINT` neighbourhood touches. */
const cellsAround = (p: Vec3): string[] => {
  const span = (n: number) => {
    const lo = Math.floor((n - SNAP_JOINT) / CELL);
    const hi = Math.floor((n + SNAP_JOINT) / CELL);
    return lo === hi ? [lo] : [lo, hi];
  };
  const keys: string[] = [];
  for (const i of span(p.x))
    for (const j of span(p.y)) for (const k of span(p.z)) keys.push(cellKey(i, j, k));
  return keys;
};

const near = (a: Vec3, b: Vec3) =>
  (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 <= SNAP_JOINT * SNAP_JOINT;

/** The indexed boxes with a snap point within `SNAP_JOINT` of any of `points`. */
export const jointsAt = (index: SnapJointIndex, points: readonly Vec3[]): Set<number> => {
  const found = new Set<number>();
  for (const p of points) {
    for (const key of cellsAround(p)) {
      for (const entry of index.cells.get(key) ?? []) if (near(p, entry.p)) found.add(entry.box);
    }
  }
  return found;
};

const buildIndex = (boxes: readonly PieceBox[], lib: SnapLib): SnapJointIndex => {
  const cells = new Map<string, { box: number; p: Vec3 }[]>();
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  boxes.forEach((box, i) => {
    const points = boxSnapPoints(box, lib);
    // Joints with the boxes already in, then this one's points go in.
    const index = { pairs, cells, lib };
    for (const j of jointsAt(index, points)) {
      const key = `${j}:${i}`;
      if (j === i || seen.has(key)) continue;
      seen.add(key);
      pairs.push([boxes[j]!.key, box.key]);
    }
    for (const p of points) {
      const key = cellKey(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL));
      const bucket = cells.get(key);
      if (bucket) bucket.push({ box: i, p });
      else cells.set(key, [{ box: i, p }]);
    }
  });
  return { pairs, cells, lib };
};

const cache = new WeakMap<readonly PieceBox[], SnapJointIndex>();

/** The snap joints among `boxes` and their index (cached per box list and catalogue). */
export const snapJoints = (boxes: readonly PieceBox[], lib: SnapLib): SnapJointIndex => {
  let index = cache.get(boxes);
  if (!index || index.lib.catalog !== lib.catalog) {
    index = buildIndex(boxes, lib);
    cache.set(boxes, index);
  }
  return index;
};
