/**
 * Snap points in the world (M17 §3.4): each drawn piece's prefab snap points placed by
 * its model's turn, and a spatial index over them for the Build tool's snap search and
 * duplicate rule. The catalogue's snap points are already in planner space (z mirrored,
 * `catalog/pieceDefs.ts`) and in the prefab's child order (the game's Q/E order): never
 * flip or sort them. Pure.
 */
import type { Library } from '../../catalog/library';
import type { PieceDef } from '../../catalog/pieceDefs';
import type { Bounds3 } from '../geometry/bounds3';
import { boxCorners, fromLocal } from '../geometry/orient';
import type { PieceBox } from '../pieceBoxes';
import type { Vec3 } from '../types';

export type SnapLib = Pick<Library, 'catalog'>;

/** The prefab's snap points in its own frame (planner space), in the game's order. */
export const localSnaps = (def: PieceDef | undefined): Vec3[] =>
  (def?.snapPoints ?? []).map(([x, y, z]) => ({ x, y, z }));

const ZERO = { x: 0, y: 0, z: 0 };

/** The turn a box's model takes: `modelTurn` when set, else `rotationY` alone. */
const modelFrame = (box: Pick<PieceBox, 'pivot' | 'rotationY' | 'modelTurn'>) =>
  box.modelTurn
    ? {
        center: box.pivot,
        size: ZERO,
        rotationY: box.modelTurn.y,
        tiltX: box.modelTurn.x,
        rollZ: box.modelTurn.z,
      }
    : { center: box.pivot, size: ZERO, rotationY: box.rotationY };

const worldSnaps = new WeakMap<PieceBox, { lib: SnapLib; points: Vec3[] }>();

/**
 * A box's snap points in the world: `pivot + Turn · local`. Walls, floors, roofs, props
 * and raw pieces all have them (by prefab); a box without a prefab has none.
 */
export const boxSnapPoints = (box: PieceBox, lib: SnapLib): Vec3[] => {
  const cached = worldSnaps.get(box);
  if (cached?.lib === lib) return cached.points;
  const def = box.prefab === null ? undefined : lib.catalog.pieces.get(box.prefab);
  const frame = modelFrame(box);
  const points = localSnaps(def).map((local) => fromLocal(local, frame));
  worldSnaps.set(box, { lib, points });
  return points;
};

/** A box's axis-aligned bounds (what it holds, turned). */
export const boxBounds = (box: PieceBox): Bounds3 => {
  const corners = boxCorners(box);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const c of corners) {
    for (const axis of ['x', 'y', 'z'] as const) {
      min[axis] = Math.min(min[axis], c[axis]);
      max[axis] = Math.max(max[axis], c[axis]);
    }
  }
  return { min, max };
};

/** Distance from a point to axis-aligned bounds (0 inside). */
export const boundsDistance = (p: Vec3, { min, max }: Bounds3): number =>
  Math.hypot(
    Math.max(min.x - p.x, 0, p.x - max.x),
    Math.max(min.y - p.y, 0, p.y - max.y),
    Math.max(min.z - p.z, 0, p.z - max.z)
  );

/** One snap point of a drawn box. */
export interface SnapTarget {
  point: Vec3;
  /** Index of the box in `SnapIndex.boxes`. */
  box: number;
  /** Index of the point among the box's snap points. */
  index: number;
}

/**
 * Drawn boxes with their world snap points and pivots hashed in 2 m cells, and their
 * bounds (for the game's 10 m reach).
 */
export interface SnapIndex {
  boxes: readonly PieceBox[];
  bounds: readonly Bounds3[];
  targets: readonly SnapTarget[];
  /** Cell key → indices into `targets`, in order. */
  cells: ReadonlyMap<string, readonly number[]>;
  /** Cell key → indices into `boxes` whose pivot is in the cell. */
  pivots: ReadonlyMap<string, readonly number[]>;
}

/** Hash cell size (metres). */
export const SNAP_CELL = 2;

const cellOf = (v: number) => Math.floor(v / SNAP_CELL);
const keyOf = (i: number, j: number, k: number) => `${i},${j},${k}`;
const pointKey = (p: Vec3) => keyOf(cellOf(p.x), cellOf(p.y), cellOf(p.z));

const push = (map: Map<string, number[]>, key: string, value: number) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

const buildIndex = (boxes: readonly PieceBox[], lib: SnapLib): SnapIndex => {
  const targets: SnapTarget[] = [];
  const cells = new Map<string, number[]>();
  const pivots = new Map<string, number[]>();
  boxes.forEach((box, b) => {
    boxSnapPoints(box, lib).forEach((point, index) => {
      push(cells, pointKey(point), targets.length);
      targets.push({ point, box: b, index });
    });
    push(pivots, pointKey(box.pivot), b);
  });
  return { boxes, bounds: boxes.map(boxBounds), targets, cells, pivots };
};

const indexes = new WeakMap<readonly PieceBox[], { lib: SnapLib; index: SnapIndex }>();

/** The snap index of a box list (cached per list and library). */
export const snapIndex = (boxes: readonly PieceBox[], lib: SnapLib): SnapIndex => {
  const cached = indexes.get(boxes);
  if (cached?.lib === lib) return cached.index;
  const index = buildIndex(boxes, lib);
  indexes.set(boxes, { lib, index });
  return index;
};

/** Ids in the cells a sphere touches, in cell order. */
const inCells = (
  map: ReadonlyMap<string, readonly number[]>,
  centre: Vec3,
  radius: number
): number[] => {
  const out: number[] = [];
  const range = (v: number) => [cellOf(v - radius), cellOf(v + radius)] as const;
  const [i0, i1] = range(centre.x);
  const [j0, j1] = range(centre.y);
  const [k0, k1] = range(centre.z);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      for (let k = k0; k <= k1; k++) out.push(...(map.get(keyOf(i, j, k)) ?? []));
    }
  }
  return out;
};

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Snap targets within `radius` of `centre`, in index order (box order, then point order). */
export const snapsNear = (index: SnapIndex, centre: Vec3, radius: number): SnapTarget[] =>
  inCells(index.cells, centre, radius)
    .sort((a, b) => a - b)
    .map((t) => index.targets[t]!)
    .filter((t) => dist(t.point, centre) <= radius);

/** Boxes whose pivot is within `radius` of `centre`, in box order. */
export const pivotsNear = (index: SnapIndex, centre: Vec3, radius: number): PieceBox[] =>
  inCells(index.pivots, centre, radius)
    .sort((a, b) => a - b)
    .map((b) => index.boxes[b]!)
    .filter((box) => dist(box.pivot, centre) <= radius);

/** Boxes whose bounds come within `margin` of `bounds`, in box order. */
export const boxesNear = (index: SnapIndex, bounds: Bounds3, margin = 0): PieceBox[] =>
  index.boxes.filter((_, b) => {
    const { min, max } = index.bounds[b]!;
    return (['x', 'y', 'z'] as const).every(
      (axis) => min[axis] <= bounds.max[axis] + margin && max[axis] >= bounds.min[axis] - margin
    );
  });
