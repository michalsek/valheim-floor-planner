/**
 * Which bodies touch. The game finds a piece's neighbours by collider overlap
 * (`Physics.OverlapBox` in `WearNTear.UpdateSupport`), not by snap points, so this
 * does too: two shapes touch when they come within ε of each other over a face, not
 * just along an edge or at a corner (see `SupportShape.touches`). A spatial hash on the
 * plan keeps it near linear; it is exposed (`contactIndex`, `touching`) so a ghost piece
 * can find its neighbours among a committed plan's without a recompute.
 */
import type { Vec3 } from '../types';

import type { Aabb, SupportShape } from './shape';

/** How far apart two colliders may be and still touch (metres, per shape). */
export const CONTACT_EPS = 0.05;
/** The narrowest face two shapes must share across their contact (metres). */
export const MIN_CONTACT_FACE = 0.1;
/** The spatial hash's cell size on the plan (metres). */
const CELL = 2;
/** Cell keys are `i · ROW + j`, unique for plans under 2,000 km across. */
const ROW = 1 << 20;

/** One direction of a contact: `body` may take support from `on`. */
export interface Contact {
  body: number;
  on: number;
  /** The point of `on`'s shape closest to `body`'s centre of mass (the support point). */
  point: Vec3;
}

/** Shapes hashed by the plan cells their bounds cover. */
export interface ContactIndex {
  shapes: readonly SupportShape[];
  /** The hash's growth: shapes are found within this of a query (metres). */
  eps: number;
  grid: ReadonlyMap<number, readonly number[]>;
  /** Which query last visited each shape, so one sharing several cells is visited once. */
  stamp: Int32Array;
  queries: number;
}

/** The plan cells a shape's bounds (grown by `eps`) cover. */
const cellsOf = ({ aabb }: SupportShape, eps: number): number[] => {
  const cell = (n: number) => Math.floor(n / CELL);
  const cells: number[] = [];
  for (let i = cell(aabb.min.x - eps); i <= cell(aabb.max.x + eps); i++) {
    for (let j = cell(aabb.min.z - eps); j <= cell(aabb.max.z + eps); j++) cells.push(i * ROW + j);
  }
  return cells;
};

/** Whether two shapes' bounds come within `2 · eps` (the cheap test before `touches`). */
const nearby = (a: Aabb, b: Aabb, eps: number): boolean =>
  a.min.x - eps <= b.max.x + eps &&
  b.min.x - eps <= a.max.x + eps &&
  a.min.y - eps <= b.max.y + eps &&
  b.min.y - eps <= a.max.y + eps &&
  a.min.z - eps <= b.max.z + eps &&
  b.min.z - eps <= a.max.z + eps;

/** The shapes hashed for `touching` (built once per shape list). */
export const contactIndex = (shapes: readonly SupportShape[], eps = CONTACT_EPS): ContactIndex => {
  const grid = new Map<number, number[]>();
  shapes.forEach((shape, i) => {
    for (const key of cellsOf(shape, eps)) {
      const bucket = grid.get(key);
      if (bucket) bucket.push(i);
      else grid.set(key, [i]);
    }
  });
  return { shapes, eps, grid, stamp: new Int32Array(shapes.length).fill(-1), queries: 0 };
};

/**
 * Calls `visit` once for each indexed shape whose bounds come near `shape`'s and that
 * `skip` doesn't rule out, until `visit` has seen them all.
 */
const forEachNear = (
  index: ContactIndex,
  shape: SupportShape,
  skip: (i: number) => boolean,
  visit: (i: number) => void
): void => {
  const query = index.queries++;
  for (const key of cellsOf(shape, index.eps)) {
    for (const i of index.grid.get(key) ?? []) {
      if (index.stamp[i] === query || skip(i)) continue;
      index.stamp[i] = query;
      if (nearby(shape.aabb, index.shapes[i]!.aabb, index.eps)) visit(i);
    }
  }
};

const touches = (index: ContactIndex, a: SupportShape, i: number): boolean =>
  a.touches(index.shapes[i]!, index.eps, MIN_CONTACT_FACE);

/** The indexed shapes `shape` touches (it needn't be indexed itself). */
export const touching = (index: ContactIndex, shape: SupportShape): number[] => {
  const found: number[] = [];
  forEachNear(
    index,
    shape,
    (i) => index.shapes[i] === shape,
    (i) => {
      if (touches(index, shape, i)) found.push(i);
    }
  );
  return found;
};

const bothWays = (shapes: readonly SupportShape[], a: number, b: number): Contact[] => [
  { body: a, on: b, point: shapes[b]!.closestPoint(shapes[a]!.com) },
  { body: b, on: a, point: shapes[a]!.closestPoint(shapes[b]!.com) },
];

/**
 * Every touching pair, both ways. `extra` adds pairs (by index) a generator knows rest
 * on each other whatever their shapes say (M12: a roof piece on a wall's top edge; M17:
 * pieces joined at a snap point).
 */
export const findContacts = (
  shapes: readonly SupportShape[],
  eps = CONTACT_EPS,
  extra: readonly (readonly [number, number])[] = [],
  index: ContactIndex = contactIndex(shapes, eps)
): Contact[] => {
  const contacts: Contact[] = [];
  const paired = new Set<number>();
  const pairKey = (a: number, b: number) => a * shapes.length + b;
  shapes.forEach((shape, a) => {
    forEachNear(
      index,
      shape,
      (b) => b <= a,
      (b) => {
        if (!touches(index, shape, b)) return;
        contacts.push(...bothWays(shapes, a, b));
        paired.add(pairKey(a, b));
      }
    );
  });
  for (const [x, y] of extra) {
    const [a, b] = x < y ? [x, y] : [y, x];
    if (a === b || paired.has(pairKey(a, b))) continue;
    paired.add(pairKey(a, b));
    contacts.push(...bothWays(shapes, a, b));
  }
  return contacts;
};
