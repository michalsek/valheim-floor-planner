/**
 * What is under a point, and what lies in a box, for selection.
 * `hitTest` tries tiers in order (vertex handle, dimension, wall) and the nearest
 * object within the first tier that has one wins. Later kinds add a tier to `TIERS`
 * (openings before walls, floors after).
 */
import type { WallFamily } from '../catalog/wallFamilies';

import { lineInBox, type BoxMode, type Polyline, type WorldBox } from './geometry/box';
import { dimensionLine } from './geometry/dimension';
import { distanceToSegment } from './geometry/measure';
import { dot, runSegments, sideNormal } from './geometry/polyline';
import { ITEM_KINDS } from './itemKinds';
import { allItems, type SelectionItem } from './selection';
import type { Dimension, DimId, Plan, Vec2, WallId, WallRun } from './types';
import { wallExtents, type WallExtents } from './wallGraph';

export type Hit =
  | { kind: 'vertex'; wallId: WallId; index: number }
  | { kind: 'dimension'; id: DimId; distance: number }
  | { kind: 'wall'; id: WallId; segment: number; distance: number };

export interface HitOptions {
  families: ReadonlyMap<string, WallFamily>;
  /** The wall whose vertices are drag handles (the single selected wall), if any. */
  handlesFor: WallId | null;
  /** Handle radius in metres. */
  handleTol: number;
}

/** The selectable object a hit is on; a vertex handle belongs to its wall. */
export const hitItem = (hit: Hit): SelectionItem =>
  hit.kind === 'vertex' ? { kind: 'wall', id: hit.wallId } : { kind: hit.kind, id: hit.id };

/**
 * Hits a run's footprint: across, from `left + tol` on one side of the drawn line to
 * `right + tol` on the other; along, up to `tol` past each end. So a block wall's
 * strip side is hittable and its empty side isn't. The distance is to the middle of
 * the footprint, for picking the nearest of several walls.
 */
const hitWall = (
  run: Pick<WallRun, 'points' | 'closed'>,
  extents: WallExtents,
  p: Vec2,
  tol: number
): { segment: number; distance: number } | null => {
  let best: { segment: number; distance: number } | null = null;
  for (const [segment, seg] of runSegments(run).entries()) {
    const rel = { x: p.x - seg.a.x, z: p.z - seg.a.z };
    const along = dot(rel, seg.dir);
    const across = dot(rel, sideNormal(seg.dir, 'right'));
    const inside =
      along >= -tol &&
      along <= seg.length + tol &&
      across >= -extents.left - tol &&
      across <= extents.right + tol;
    if (!inside) continue;
    const beyond = Math.max(0, -along, along - seg.length);
    const distance = Math.hypot(beyond, across - (extents.right - extents.left) / 2);
    if (!best || distance < best.distance) best = { segment, distance };
  }
  return best;
};

/** The dimension whose drawn line is nearest to `p`, within `tol` metres. */
export const hitDimension = (
  dims: Record<DimId, Dimension>,
  p: Vec2,
  tol: number
): { id: DimId; distance: number } | null => {
  let best: { id: DimId; distance: number } | null = null;
  for (const dim of Object.values(dims)) {
    const line = dimensionLine(dim);
    const distance = distanceToSegment(p, line.a, line.b);
    if (distance <= tol && (!best || distance < best.distance)) best = { id: dim.id, distance };
  }
  return best;
};

type Tier = (plan: Plan, p: Vec2, tol: number, opts: HitOptions) => Hit | null;

const vertexTier: Tier = (plan, p, _tol, { handlesFor, handleTol }) => {
  const run = handlesFor === null ? undefined : plan.walls[handlesFor];
  if (!run) return null;
  let best: Hit | null = null;
  let bestDistance = handleTol;
  for (const [index, q] of run.points.entries()) {
    const distance = Math.hypot(p.x - q.x, p.z - q.z);
    if (distance <= bestDistance) {
      best = { kind: 'vertex', wallId: run.id, index };
      bestDistance = distance;
    }
  }
  return best;
};

const dimensionTier: Tier = (plan, p, tol) => {
  const hit = hitDimension(plan.dimensions, p, tol);
  return hit && { kind: 'dimension', ...hit };
};

const wallTier: Tier = (plan, p, tol, { families }) => {
  let best: Hit | null = null;
  let bestDistance = Infinity;
  for (const run of Object.values(plan.walls)) {
    const family = families.get(run.familyId);
    // An unknown family has no thickness; hit its drawn line only.
    const extents = family ? wallExtents(run.side, family) : { left: 0, right: 0 };
    const hit = hitWall(run, extents, p, tol);
    if (hit && hit.distance < bestDistance) {
      best = { kind: 'wall', id: run.id, ...hit };
      bestDistance = hit.distance;
    }
  }
  return best;
};

const TIERS: readonly Tier[] = [vertexTier, dimensionTier, wallTier];

/** The topmost thing under `p` (within `tol` metres), or null. */
export const hitTest = (plan: Plan, p: Vec2, tol: number, opts: HitOptions): Hit | null => {
  for (const tier of TIERS) {
    const hit = tier(plan, p, tol, opts);
    if (hit) return hit;
  }
  return null;
};

/** Items whose drawn lines lie inside (or touch) the box, in plan order. */
export const itemsInBox = (plan: Plan, box: WorldBox, mode: BoxMode): SelectionItem[] =>
  allItems(plan).filter((item) => {
    const lines = ITEM_KINDS[item.kind].lines(plan, item.id);
    const test = (line: Polyline) => lineInBox(line, box, mode);
    return lines.length > 0 && (mode === 'contain' ? lines.every(test) : lines.some(test));
  });
