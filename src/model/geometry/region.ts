/**
 * Orthogonal regions as horizontal slabs: exact boolean operations for axis-aligned
 * shapes (rooms, wall strips), with no offsetting and so no self-intersections. A
 * region can have any number of pieces and holes.
 */
import type { Vec2 } from '../types';

import { EPS } from './polyline';
import { simplifyRing, type Box, type Ring } from './rings';

/** [x0, x1] with x0 < x1. */
export type Interval = readonly [number, number];

export interface Slab {
  z0: number;
  z1: number;
  /** Sorted, disjoint, non-touching x-intervals. */
  intervals: Interval[];
}

/** Slabs sorted by z, contiguous (empty slabs allowed). */
export type Region = Slab[];

export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

type Op = (inA: boolean, inB: boolean) => boolean;

const sortedUnique = (values: readonly number[]): number[] =>
  [...new Set(values)].sort((a, b) => a - b);

const covered = (list: readonly Interval[], x: number): boolean =>
  list.some(([x0, x1]) => x0 < x && x < x1);

/** The x-ranges where `op` holds, merged; inputs may overlap. */
const combineIntervals = (a: readonly Interval[], b: readonly Interval[], op: Op): Interval[] => {
  const xs = sortedUnique([...a.flat(), ...b.flat()]);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const x0 = xs[i]!;
    const x1 = xs[i + 1]!;
    const mid = (x0 + x1) / 2;
    if (!op(covered(a, mid), covered(b, mid))) continue;
    const last = out.at(-1);
    if (last && last[1] === x0) last[1] = x1;
    else out.push([x0, x1]);
  }
  return out;
};

const intervalsAt = (region: Region, z: number): Interval[] =>
  region.find((s) => s.z0 < z && z < s.z1)?.intervals ?? [];

const build = (zs: readonly number[], intervalsAtZ: (z: number) => Interval[]): Region => {
  const sorted = sortedUnique(zs);
  const slabs: Region = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const z0 = sorted[i]!;
    const z1 = sorted[i + 1]!;
    slabs.push({ z0, z1, intervals: intervalsAtZ((z0 + z1) / 2) });
  }
  return slabs;
};

const bounds = (region: Region): number[] => region.flatMap((s) => [s.z0, s.z1]);

const combine = (a: Region, b: Region, op: Op): Region =>
  build([...bounds(a), ...bounds(b)], (z) =>
    combineIntervals(intervalsAt(a, z), intervalsAt(b, z), op)
  );

export const union = (a: Region, b: Region): Region => combine(a, b, (p, q) => p || q);
export const subtract = (a: Region, b: Region): Region => combine(a, b, (p, q) => p && !q);

/** The even-odd interior of orthogonal rings (holes included as further rings). */
export const regionFromRings = (rings: readonly (readonly Vec2[])[]): Region =>
  build(
    rings.flatMap((r) => r.map((p) => p.z)),
    (z) => {
      const xs: number[] = [];
      for (const ring of rings) {
        ring.forEach((a, i) => {
          const b = ring[(i + 1) % ring.length]!;
          if (a.x === b.x && a.z > z !== b.z > z) xs.push(a.x);
        });
      }
      xs.sort((p, q) => p - q);
      const pairs: Interval[] = [];
      for (let i = 0; i + 1 < xs.length; i += 2) pairs.push([xs[i]!, xs[i + 1]!]);
      return combineIntervals(pairs, [], (p) => p);
    }
  );

export const regionFromRects = (rects: readonly Rect[]): Region => {
  const solid = rects.filter((r) => r.x1 - r.x0 > EPS && r.z1 - r.z0 > EPS);
  return build(
    solid.flatMap((r) => [r.z0, r.z1]),
    (z) =>
      combineIntervals(
        solid.filter((r) => r.z0 < z && z < r.z1).map((r): Interval => [r.x0, r.x1]),
        [],
        (p) => p
      )
  );
};

export const regionArea = (region: Region): number =>
  region.reduce(
    (sum, s) => sum + (s.z1 - s.z0) * s.intervals.reduce((w, [x0, x1]) => w + x1 - x0, 0),
    0
  );

export const regionBox = (region: Region): Box | null => {
  const filled = region.filter((s) => s.intervals.length > 0);
  if (filled.length === 0) return null;
  const min = {
    x: Math.min(...filled.map((s) => s.intervals[0]![0])),
    z: filled[0]!.z0,
  };
  const max = {
    x: Math.max(...filled.map((s) => s.intervals.at(-1)![1])),
    z: filled.at(-1)!.z1,
  };
  return { min, max, w: max.x - min.x, d: max.z - min.z };
};

/** Direction slots, rising with the clockwise screen angle: +x, +z, −x, −z. */
const slotOf = (from: Vec2, to: Vec2): number => {
  if (from.z === to.z) return to.x > from.x ? 0 : 2;
  return to.z > from.z ? 1 : 3;
};

const pointKey = (p: Vec2): string => `${p.x},${p.z}`;

/**
 * The region's outlines: pieces clockwise on screen (positive area), holes
 * anticlockwise. Pieces touching at a corner come out as separate rings.
 */
export const regionRings = (region: Region): Ring[] => {
  const edges: { a: Vec2; b: Vec2 }[] = [];
  for (const { z0, z1, intervals } of region) {
    for (const [x0, x1] of intervals) {
      edges.push({ a: { x: x1, z: z0 }, b: { x: x1, z: z1 } });
      edges.push({ a: { x: x0, z: z1 }, b: { x: x0, z: z0 } });
    }
  }
  for (const z of sortedUnique(bounds(region))) {
    const above = region.find((s) => s.z1 === z)?.intervals ?? [];
    const below = region.find((s) => s.z0 === z)?.intervals ?? [];
    for (const [x0, x1] of combineIntervals(above, below, (u, d) => u && !d)) {
      edges.push({ a: { x: x1, z }, b: { x: x0, z } });
    }
    for (const [x0, x1] of combineIntervals(above, below, (u, d) => d && !u)) {
      edges.push({ a: { x: x0, z }, b: { x: x1, z } });
    }
  }

  const outgoing = new Map<string, (number | undefined)[]>();
  edges.forEach((e, i) => {
    const slots = outgoing.get(pointKey(e.a)) ?? [];
    slots[slotOf(e.a, e.b)] = i;
    outgoing.set(pointKey(e.a), slots);
  });
  // Keep the interior on the right: take the sharpest right turn (as in faces.ts).
  const next = (i: number): number => {
    const { a, b } = edges[i]!;
    const slots = outgoing.get(pointKey(b))!;
    const back = slotOf(b, a);
    for (let step = 1; step <= 4; step++) {
      const j = slots[(back - step + 4) % 4];
      if (j !== undefined) return j;
    }
    throw new Error('Region outline is not closed');
  };

  const visited = new Set<number>();
  const rings: Ring[] = [];
  edges.forEach((_, start) => {
    if (visited.has(start)) return;
    const ring: Vec2[] = [];
    for (let i = start; !visited.has(i); i = next(i)) {
      visited.add(i);
      ring.push(edges[i]!.a);
    }
    rings.push(simplifyRing(ring));
  });
  return rings;
};
