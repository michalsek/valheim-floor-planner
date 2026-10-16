/**
 * Closed rings of points (rooms, outlines). Orientation follows `signedArea`:
 * positive is clockwise on screen (+x right, +z down).
 */
import type { Vec2 } from '../types';

import { cross, direction, EPS, signedArea } from './polyline';

/** A closed ring; the first point is not repeated. */
export type Ring = Vec2[];

export interface Box {
  min: Vec2;
  max: Vec2;
  /** Size along x. */
  w: number;
  /** Size along z. */
  d: number;
}

export const ringArea = (ring: readonly Vec2[]): number => Math.abs(signedArea(ring));

export const ringBox = (ring: readonly Vec2[]): Box => {
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  const min = { x: Math.min(...xs), z: Math.min(...zs) };
  const max = { x: Math.max(...xs), z: Math.max(...zs) };
  return { min, max, w: max.x - min.x, d: max.z - min.z };
};

/** Even-odd point-in-ring test (points exactly on an edge may go either way). */
export const pointInRing = (p: Vec2, ring: readonly Vec2[]): boolean => {
  let inside = false;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    if (a.z > p.z !== b.z > p.z) {
      const x = a.x + ((p.z - a.z) * (b.x - a.x)) / (b.z - a.z);
      if (p.x < x) inside = !inside;
    }
  });
  return inside;
};

/**
 * Drops repeated points and points whose two edges are collinear: straight-through
 * vertices, and the tips of zero-width spikes (a filament walked out and back).
 */
export const simplifyRing = (ring: readonly Vec2[]): Ring => {
  let result = [...ring];
  let changed = true;
  while (changed && result.length > 2) {
    changed = false;
    const n = result.length;
    for (let i = 0; i < n; i++) {
      const prev = result[(i - 1 + n) % n]!;
      const p = result[i]!;
      const next = result[(i + 1) % n]!;
      const u = direction(prev, p);
      const v = direction(p, next);
      if (!u || !v || Math.abs(cross(u, v)) < EPS) {
        result = result.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return result;
};

/** True for a simplified ring that is an axis-aligned rectangle. */
export const isAxisRect = (ring: readonly Vec2[]): boolean =>
  ring.length === 4 &&
  ring.every((p, i) => {
    const q = ring[(i + 1) % 4]!;
    return Math.abs(p.x - q.x) < EPS || Math.abs(p.z - q.z) < EPS;
  });
