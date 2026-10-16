/**
 * Where to put a room's label: the centre of a roomy axis-aligned rectangle inside
 * the region, so it never lands in the missing corner of an L, on an inner room or
 * in a narrow neck.
 */
import type { Vec2 } from '../types';

import { EPS } from './polyline';
import type { Interval, Region, Slab } from './region';

export interface LabelSpot {
  center: Vec2;
  /** Free width (x) and depth (z) around the centre, in metres. */
  w: number;
  d: number;
}

/**
 * Labels are about this many times wider than tall, so a rectangle's depth counts
 * this much more than its width when picking the roomiest one.
 */
const LABEL_ASPECT = 3;

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const covers = (slab: Slab, [x0, x1]: Interval): boolean =>
  slab.intervals.some(([a, b]) => a <= x0 && b >= x1);

const score = (r: Rect) => {
  const w = r.x1 - r.x0;
  const d = r.z1 - r.z0;
  return { roomy: Math.min(w, d * LABEL_ASPECT), area: w * d };
};

const better = (r: Rect, than: Rect | null): boolean => {
  if (!than) return true;
  const a = score(r);
  const b = score(than);
  return a.roomy > b.roomy + EPS || (a.roomy > b.roomy - EPS && a.area > b.area + EPS);
};

/** Each slab interval, grown up and down through the slabs that still cover it. */
export const labelSpot = (region: Region): LabelSpot | null => {
  let best: Rect | null = null;
  for (const [k, slab] of region.entries()) {
    for (const interval of slab.intervals) {
      let top = k;
      let bottom = k;
      while (top > 0 && covers(region[top - 1]!, interval)) top--;
      while (bottom + 1 < region.length && covers(region[bottom + 1]!, interval)) bottom++;
      const rect = {
        x0: interval[0],
        x1: interval[1],
        z0: region[top]!.z0,
        z1: region[bottom]!.z1,
      };
      if (better(rect, best)) best = rect;
    }
  }
  if (!best) return null;
  const { x0, x1, z0, z1 } = best;
  return { center: { x: (x0 + x1) / 2, z: (z0 + z1) / 2 }, w: x1 - x0, d: z1 - z0 };
};
