/**
 * Where the expand handles of a site's terrain sit, in the plan: one per patch edge
 * (west, east, south, north in the world), a stretch of the edge's middle with the
 * ground's height there, the way out, and the strip a step would add.
 */
import type { SiteSide } from '../../model/terrain/siteExtend';
import { groundAtWorld, worldToPlan } from '../../model/terrain/siteTerrain';
import type { Vec2 } from '../../model/types';
import type { SiteGround } from '../../store/siteTerrain';

/** A handle's length along its edge (metres), at most this share of the edge. */
const HANDLE_LENGTH = 48;
const HANDLE_SHARE = 0.4;
/** Ground samples along a handle, for its base (metres apart). */
const BASE_STEP = 4;

export interface SiteHandle {
  side: SiteSide;
  /** The handle's ends on the patch edge (plan). */
  ends: [Vec2, Vec2];
  /** The highest ground under it (plan height): the 3D wall stands on it. */
  base: number;
  /** The plan direction out of the patch (unit). */
  outward: Vec2;
  /** The whole edge's ends (plan), for the strip a step adds. */
  edge: [Vec2, Vec2];
}

/** A world edge of the patch: its ends and the world direction out of it. */
const worldEdge = (ground: SiteGround, side: SiteSide) => {
  const { x0, z0, cols, rows } = ground.grid;
  const x1 = x0 + cols - 1;
  const z1 = z0 + rows - 1;
  switch (side) {
    case 'west':
      return { a: { x: x0, z: z0 }, b: { x: x0, z: z1 }, out: { x: -1, z: 0 } };
    case 'east':
      return { a: { x: x1, z: z0 }, b: { x: x1, z: z1 }, out: { x: 1, z: 0 } };
    case 'south':
      return { a: { x: x0, z: z0 }, b: { x: x1, z: z0 }, out: { x: 0, z: -1 } };
    case 'north':
      return { a: { x: x0, z: z1 }, b: { x: x1, z: z1 }, out: { x: 0, z: 1 } };
  }
};

const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
});

/** The handle on `side` of the site's patch. */
export const siteHandle = (ground: SiteGround, side: SiteSide): SiteHandle => {
  const { frame, grid } = ground;
  const { a, b, out } = worldEdge(ground, side);
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const half = Math.min(HANDLE_LENGTH, length * HANDLE_SHARE) / 2 / length;
  const [p, q] = [lerp(a, b, 0.5 - half), lerp(a, b, 0.5 + half)];
  let base = -Infinity;
  const samples = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / BASE_STEP));
  for (let s = 0; s <= samples; s++) {
    const w = lerp(p, q, s / samples);
    base = Math.max(base, groundAtWorld(grid, w.x, w.z) ?? -Infinity);
  }
  const mid = lerp(a, b, 0.5);
  const from = worldToPlan(frame, mid);
  const to = worldToPlan(frame, { x: mid.x + out.x, z: mid.z + out.z });
  return {
    side,
    ends: [worldToPlan(frame, p), worldToPlan(frame, q)],
    base: Number.isFinite(base) ? base : 0,
    outward: { x: to.x - from.x, z: to.z - from.z },
    edge: [worldToPlan(frame, a), worldToPlan(frame, b)],
  };
};

/** The plan outline of the strip `metres` deep beyond the handle's edge. */
export const stripOutline = (handle: SiteHandle, metres: number): Vec2[] => {
  const [a, b] = handle.edge;
  const push = (p: Vec2) => ({
    x: p.x + handle.outward.x * metres,
    z: p.z + handle.outward.z * metres,
  });
  return [a, b, push(b), push(a)];
};

/** A point on the screen (CSS px). */
interface Point {
  x: number;
  y: number;
}

/**
 * Where along the screen segment ab (t from 0 to 1) a handle `length` px long goes: in
 * the middle of the part inside `view` (less `margin`), kept on the segment; null when
 * none of it is in view. With the whole edge in view, that is its middle.
 */
export const visibleSpan = (
  a: Point,
  b: Point,
  length: number,
  view: { width: number; height: number },
  margin: number
): { from: number; to: number } | null => {
  const d = { x: b.x - a.x, y: b.y - a.y };
  let t0 = 0;
  let t1 = 1;
  const limits: [number, number][] = [
    [-d.x, a.x - margin],
    [d.x, view.width - margin - a.x],
    [-d.y, a.y - margin],
    [d.y, view.height - margin - a.y],
  ];
  for (const [p, q] of limits) {
    if (p === 0) {
      if (q < 0) return null;
    } else if (p < 0) t0 = Math.max(t0, q / p);
    else t1 = Math.min(t1, q / p);
    if (t0 > t1) return null;
  }
  const half = Math.min(0.5, length / 2 / (Math.hypot(d.x, d.y) || 1));
  const mid = Math.min(1 - half, Math.max(half, (t0 + t1) / 2));
  return { from: mid - half, to: mid + half };
};
