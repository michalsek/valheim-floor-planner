/**
 * A 3D ray against an imported site's ground (the Build tool's ghost follows it): march
 * along the ray, then bisect the crossing. Only a crossing from above counts, as the
 * ground is drawn from above only (the camera can go under it). Pure.
 */
import { pointOnRay, type Ray3 } from '../geometry/ray';
import type { Vec3 } from '../types';

import {
  groundAt,
  heightRange,
  worldToPlan,
  type SiteFrame,
  type TerrainGrid,
} from './siteTerrain';

/** March step along the ray (metres). */
const STEP = 0.5;
/** The ray is marched from a little above the highest ground to a little below the lowest (metres). */
const MARGIN = 0.01;
/** The crossing is bisected to this (metres along the ray). */
const TOLERANCE = 0.001;

/** The span of t in [from, to] over which `o + t·d` lies within [min, max] (one axis). */
const clip = (
  [from, to]: [number, number],
  o: number,
  d: number,
  min: number,
  max: number
): [number, number] | null => {
  if (Math.abs(d) < 1e-12) return o >= min && o <= max ? [from, to] : null;
  const ta = (min - o) / d;
  const tb = (max - o) / d;
  const clipped: [number, number] = [
    Math.max(from, Math.min(ta, tb)),
    Math.min(to, Math.max(ta, tb)),
  ];
  return clipped[0] <= clipped[1] ? clipped : null;
};

/** Where along the ray it is over the patch (its plan bounds) and within its heights. */
const span = (
  r: Ray3,
  grid: TerrainGrid,
  frame: SiteFrame,
  maxT: number
): [number, number] | null => {
  const { min, max } = heightRange(grid);
  const corners = [
    [0, 0],
    [grid.cols - 1, 0],
    [0, grid.rows - 1],
    [grid.cols - 1, grid.rows - 1],
  ].map(([i, j]) => worldToPlan(frame, { x: grid.x0 + i!, z: grid.z0 + j! }));
  const xs = corners.map((c) => c.x);
  const zs = corners.map((c) => c.z);
  let range: [number, number] | null = [0, maxT];
  range = range && clip(range, r.origin.y, r.dir.y, min - MARGIN, max + MARGIN);
  range = range && clip(range, r.origin.x, r.dir.x, Math.min(...xs), Math.max(...xs));
  range = range && clip(range, r.origin.z, r.dir.z, Math.min(...zs), Math.max(...zs));
  return range;
};

/**
 * Where the ray first passes down through the ground within `maxT`, to 1 mm; null when
 * it doesn't (off the patch, or only from below). A crest thinner than the 0.5 m step
 * can be missed.
 */
export const rayTerrain = (
  r: Ray3,
  grid: TerrainGrid,
  frame: SiteFrame,
  maxT: number
): { t: number; point: Vec3 } | null => {
  const clipped = span(r, grid, frame, maxT);
  if (!clipped) return null;
  const [from, to] = clipped;
  /** Height of the ray over the ground at t; null off the patch. */
  const above = (t: number): number | null => {
    const p = pointOnRay(r, t);
    const ground = groundAt(grid, frame, { x: p.x, z: p.z });
    return ground === null ? null : p.y - ground;
  };
  let prevT = from;
  let prev = above(from);
  for (let t = from; t < to;) {
    t = Math.min(to, t + STEP);
    const h = above(t);
    if (prev !== null && h !== null && prev >= 0 && h <= 0) {
      let lo = prevT;
      let hi = t;
      while (hi - lo > TOLERANCE) {
        const mid = (lo + hi) / 2;
        const hm = above(mid);
        if (hm !== null && hm <= 0) hi = mid;
        else lo = mid;
      }
      return { t: hi, point: pointOnRay(r, hi) };
    }
    prevT = t;
    prev = h;
  }
  return null;
};
