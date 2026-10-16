/** Where a click with the opening tool would put an opening (pure). */
import type { OpeningDef } from '../../catalog/openingDefs';
import { stripOffset, type WallFamily } from '../../catalog/wallFamilies';
import { formatCompact } from '../../format';
import { addVec, dot, pointAlong, runSegments, sideNormal } from '../../model/geometry/polyline';
import { wallAt } from '../../model/hitTest';
import {
  findOverlap,
  openingRange,
  snapOpeningStart,
  type ResolvedOpening,
} from '../../model/openings';
import type { Plan, Vec2, WallId } from '../../model/types';

export interface Placement {
  wallId: WallId;
  segment: number;
  /** Metres along the segment from its first point. */
  start: number;
  /** The opening's centre on the drawn line: the anchor a click stores. */
  center: Vec2;
  /** The centre of the gap: on the strip's centre line for block walls. */
  stripCenter: Vec2;
  dir: Vec2;
  /** The longest opening the segment can take (ignoring other openings). */
  room: number;
  valid: boolean;
  /** Why a click would do nothing. */
  reason?: string;
}

/**
 * The placement of `def` on the wall under `p`, or null when no wall is there. Its
 * start snaps to whole metres along the segment (unless `free`) and is kept clear of
 * block-wall corners; overlapping another opening or not fitting makes it invalid.
 */
export const placeOpening = (
  plan: Plan,
  openings: readonly ResolvedOpening[],
  families: ReadonlyMap<string, WallFamily>,
  def: OpeningDef,
  p: Vec2,
  tol: number,
  free: boolean
): Placement | null => {
  const hit = wallAt(plan, p, tol, families);
  const run = hit && plan.walls[hit.id];
  const segs = run ? runSegments(run) : [];
  const seg = hit ? segs[hit.segment] : undefined;
  if (!hit || !run || !seg) return null;

  const family = families.get(run.familyId);
  const range = openingRange(run, segs, hit.segment, family);
  const rel = { x: p.x - seg.a.x, z: p.z - seg.a.z };
  const along = Math.min(Math.max(dot(rel, seg.dir), 0), seg.length);
  const normal = sideNormal(seg.dir, run.side);
  const offset = family ? stripOffset(family) : 0;
  const at = (t: number) => {
    const center = pointAlong(seg, t);
    return { center, stripCenter: addVec(center, { x: normal.x * offset, z: normal.z * offset }) };
  };
  const room = Math.max(range.max - range.min, 0);
  const base = { wallId: run.id, segment: hit.segment, dir: seg.dir, room };

  const start = snapOpeningStart(along, def.width, range, free);
  if (start === null) {
    const reason = `needs ${formatCompact(def.width)} m, ${formatCompact(room)} m free`;
    return { ...base, ...at(along), start: along - def.width / 2, valid: false, reason };
  }
  const placed = { ...base, ...at(start + def.width / 2), start };
  const mine = openings.filter((o) => o.wallId === run.id);
  const overlap = findOverlap(mine, hit.segment, start, def.width);
  if (overlap) return { ...placed, valid: false, reason: `overlaps ${overlap.def.label}` };
  return { ...placed, valid: true };
};
