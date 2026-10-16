/**
 * Openings on walls. An opening stores a world anchor on the wall's drawn line; this
 * module finds the segment it is on (in `runSegments` numbering), checks that it fits,
 * and moves anchors along with the edits that really move a wall's geometry.
 */
import type { Library } from '../catalog/library';
import type { OpeningDef } from '../catalog/openingDefs';
import { stripOffset, type WallFamily } from '../catalog/wallFamilies';

import {
  addVec,
  dot,
  EPS,
  isLoop,
  pointAlong,
  runSegments,
  samePoint,
  segments,
  sideNormal,
  type Segment,
} from './geometry/polyline';
import { segmentCorners, type WallCut } from './splitWall';
import type { Opening, OpeningId, Plan, Vec2, WallId, WallRun } from './types';

export type OpeningProblem = 'offWall' | 'doesNotFit' | 'overlaps' | 'unknownPrefab';

export interface ResolvedOpening {
  id: OpeningId;
  wallId: WallId;
  prefab: string;
  def: OpeningDef | null;
  /** The segment the anchor is on, or null when it is on none. */
  segment: number | null;
  /** Where the opening starts: metres along the segment from its first point. */
  start: number;
  /** The opening's centre on the drawn line. */
  center: Vec2;
  /** The centre of the gap in the wall: on the strip's centre line for block walls. */
  stripCenter: Vec2;
  /** The segment's direction. */
  dir: Vec2;
  /** Unit normal towards the wall's `side` (inside, on a loop). */
  normal: Vec2;
  /** Why the opening isn't cut, or null when it is. */
  problem: OpeningProblem | null;
  /** Taller than the wall: when cut, it cuts the wall's full height. */
  tooTall: boolean;
}

/** An opening that is cut into its wall. */
export type CutOpening = ResolvedOpening & { def: OpeningDef; segment: number; problem: null };

export const isCut = (r: ResolvedOpening): r is CutOpening =>
  r.problem === null && r.def !== null && r.segment !== null;

/** Allowed span for an opening on a segment, in metres from its first point. */
export interface OpeningRange {
  min: number;
  max: number;
}

/** How far off the line an anchor may be and still be on it. */
const ON_LINE = 1e-4;

/** Every non-degenerate segment whose line holds `at`, with how far along it `at` is. */
const locateOnRun = (segs: readonly Segment[], at: Vec2): { segment: number; along: number }[] =>
  segs.flatMap((seg, segment) => {
    if (seg.length < EPS) return [];
    const rel = { x: at.x - seg.a.x, z: at.z - seg.a.z };
    const along = dot(rel, seg.dir);
    const across = dot(rel, sideNormal(seg.dir, 'right'));
    const on = Math.abs(across) < ON_LINE && along > -ON_LINE && along < seg.length + ON_LINE;
    return on ? [{ segment, along }] : [];
  });

/**
 * Where an opening may go on segment `i`: the whole segment on panel walls. On block
 * walls the corner column is never cut: `thickness` is kept clear at an end where the
 * strips overlap (there the column is inside the segment); where they leave a gap the
 * column lies beyond the segment, so nothing is reserved.
 */
export const openingRange = (
  run: Pick<WallRun, 'closed' | 'side'>,
  segs: readonly Segment[],
  i: number,
  family: WallFamily | undefined
): OpeningRange => {
  const length = segs[i]?.length ?? 0;
  if (family?.snapKind !== 'face') return { min: 0, max: length };
  const corners = segmentCorners(segs, i, isLoop(run, segs), run.side);
  const t = family.thickness;
  return {
    min: corners.start === 'overlap' ? t : 0,
    max: length - (corners.end === 'overlap' ? t : 0),
  };
};

const fits = (start: number, width: number, range: OpeningRange): boolean =>
  start >= range.min - EPS && start + width <= range.max + EPS;

/** The cut opening on `segment` (not one of `except`) that a span would overlap. */
export const findOverlap = (
  openings: readonly ResolvedOpening[],
  segment: number,
  start: number,
  width: number,
  except: ReadonlySet<OpeningId> = new Set()
): CutOpening | null =>
  openings.find(
    (o): o is CutOpening =>
      isCut(o) &&
      !except.has(o.id) &&
      o.segment === segment &&
      start < o.start + o.def.width - EPS &&
      o.start < start + width - EPS
  ) ?? null;

const placeOne = (
  run: WallRun,
  segs: readonly Segment[],
  family: WallFamily | undefined,
  opening: Opening,
  defs: ReadonlyMap<string, OpeningDef>
): ResolvedOpening => {
  const def = defs.get(opening.prefab) ?? null;
  const base = {
    id: opening.id,
    wallId: run.id,
    prefab: opening.prefab,
    def,
    tooTall: !!def && def.height > run.height + EPS,
  };
  const width = def?.width ?? 0;
  const hits = locateOnRun(segs, opening.at).map((hit) => ({
    ...hit,
    start: hit.along - width / 2,
    range: openingRange(run, segs, hit.segment, family),
  }));
  const hit = hits.find((h) => fits(h.start, width, h.range)) ?? hits[0];
  const seg = hit && segs[hit.segment];
  if (!hit || !seg) {
    const at = opening.at;
    const offWall = { center: at, stripCenter: at, dir: { x: 1, z: 0 }, normal: { x: 0, z: 1 } };
    return { ...base, ...offWall, segment: null, start: 0, problem: 'offWall' };
  }
  const center = pointAlong(seg, hit.along);
  const normal = sideNormal(seg.dir, run.side);
  const offset = family ? stripOffset(family) : 0;
  return {
    ...base,
    segment: hit.segment,
    start: hit.start,
    center,
    stripCenter: addVec(center, { x: normal.x * offset, z: normal.z * offset }),
    dir: seg.dir,
    normal,
    problem: !def ? 'unknownPrefab' : fits(hit.start, width, hit.range) ? null : 'doesNotFit',
  };
};

/**
 * Resolves a wall's openings (in their given order). Of two overlapping openings the
 * one with the lower start (then the lower id) is cut; the other is flagged.
 */
export const resolveOpenings = (
  run: WallRun,
  family: WallFamily | undefined,
  openings: readonly Opening[],
  defs: ReadonlyMap<string, OpeningDef>
): ResolvedOpening[] => {
  const segs = runSegments(run);
  const placed = openings.map((o) => placeOne(run, segs, family, o, defs));
  const order = placed
    .filter(isCut)
    .sort((a, b) => a.segment - b.segment || a.start - b.start || a.id.localeCompare(b.id));
  const losers = new Set<OpeningId>();
  order.forEach((r, i) => {
    const kept = order.slice(0, i).filter((k) => !losers.has(k.id));
    if (findOverlap(kept, r.segment, r.start, r.def.width)) losers.add(r.id);
  });
  return placed.map((r) => (losers.has(r.id) ? { ...r, problem: 'overlaps' } : r));
};

/** The gaps `splitWall` cuts for the openings that have no problem. */
export const wallCuts = (resolved: readonly ResolvedOpening[]): WallCut[] =>
  resolved
    .filter(isCut)
    .map((r) => ({ segment: r.segment, start: r.start, width: r.def.width, height: r.def.height }));

/**
 * The start for an opening `width` wide centred near `along`: on whole metres from the
 * segment's start (unless `free`), pulled into `range`. Null when it can't fit at all.
 */
export const snapOpeningStart = (
  along: number,
  width: number,
  range: OpeningRange,
  free: boolean
): number | null => {
  if (range.max - range.min < width - EPS) return null;
  const raw = along - width / 2;
  const start = free ? raw : Math.round(raw);
  return Math.min(Math.max(start, range.min), range.max - width);
};

/**
 * New anchors for a wall's openings after a corner drag: each moves with its old
 * segment's perpendicular displacement and keeps its position along the axis.
 * `movedPoints` are `oldRun.points` moved, before normalisation (same indices).
 * Orthogonal drags move both ends of a segment equally; a diagonal (hand-edited)
 * segment whose ends move differently tilts, so its openings take the average shift
 * and may end up off the line, where the derive flags them.
 */
export const carryOpenings = (
  oldRun: WallRun,
  movedPoints: readonly Vec2[],
  openings: readonly Opening[]
): { id: OpeningId; at: Vec2 }[] => {
  const before = segments(oldRun.points, oldRun.closed);
  const after = segments(movedPoints, oldRun.closed);
  return openings.flatMap((o) => {
    const [hit] = locateOnRun(before, o.at);
    const from = hit && before[hit.segment];
    const to = hit && after[hit.segment];
    if (!from || !to) return [];
    const n = sideNormal(from.dir, 'right');
    const shift =
      (dot({ x: to.a.x - from.a.x, z: to.a.z - from.a.z }, n) +
        dot({ x: to.b.x - from.b.x, z: to.b.z - from.b.z }, n)) /
      2;
    if (Math.abs(shift) < EPS) return [];
    return [{ id: o.id, at: addVec(o.at, { x: n.x * shift, z: n.z * shift }) }];
  });
};

/** The openings on a wall, in plan order. */
export const openingsOf = (plan: Plan, wallId: WallId): Opening[] =>
  Object.values(plan.openings).filter((o) => o.wallId === wallId);

type OpeningLib = Pick<Library, 'wallFamilies' | 'openingDefs'>;

/** A wall's openings resolved, with what checking a new span on it needs. */
const wallContext = (plan: Plan, lib: OpeningLib, wallId: WallId) => {
  const run = plan.walls[wallId];
  if (!run) return null;
  const family = lib.wallFamilies.get(run.familyId);
  const segs = runSegments(run);
  const resolved = resolveOpenings(run, family, openingsOf(plan, wallId), lib.openingDefs);
  const rangeOf = (segment: number) => openingRange(run, segs, segment, family);
  return { segs, resolved, rangeOf };
};

/** Whole metres, rounding halves away from zero in both directions (so ← and → match). */
const roundMetres = (v: number): number => {
  const metres = Math.round(Math.abs(v));
  return v < 0 ? -metres : metres;
};

export type SlideResult = { at: Vec2 } | 'refused' | 'unchanged';

/**
 * Slides openings `ids` together by `delta`, each projected onto its segment and moved
 * by whole metres (so an off-grid opening keeps its offset). Openings sliding together
 * don't block each other: those on one segment all move by the same amount. If any
 * opening of a wall would leave its range or overlap one that stays, all of that
 * wall's slides are refused, so none moves into another's old place.
 */
export const slideOpenings = (
  plan: Plan,
  lib: OpeningLib,
  ids: readonly OpeningId[],
  delta: Vec2
): Map<OpeningId, SlideResult> => {
  const results = new Map<OpeningId, SlideResult>();
  const moving = new Set(ids);
  const walls = new Set(ids.flatMap((id) => plan.openings[id]?.wallId ?? []));
  for (const wallId of walls) {
    const wall = wallContext(plan, lib, wallId);
    const mine = wall?.resolved.filter((r) => moving.has(r.id)) ?? [];
    const slid = mine.map((r): [OpeningId, SlideResult] => {
      const seg = r.segment === null ? undefined : wall?.segs[r.segment];
      if (!wall || !r.def || r.segment === null || !seg) return [r.id, 'refused'];
      const shift = roundMetres(dot(delta, r.dir));
      if (shift === 0) return [r.id, 'unchanged'];
      const start = r.start + shift;
      const blocked =
        !fits(start, r.def.width, wall.rangeOf(r.segment)) ||
        findOverlap(wall.resolved, r.segment, start, r.def.width, moving) !== null;
      if (blocked) return [r.id, 'refused'];
      const at = pointAlong(seg, start + r.def.width / 2);
      const from = plan.openings[r.id]?.at;
      return [r.id, from && samePoint(from, at) ? 'unchanged' : { at }];
    });
    const refused = slid.some(([, result]) => result === 'refused');
    for (const [id, result] of slid)
      results.set(id, refused && result !== 'unchanged' ? 'refused' : result);
  }
  for (const id of ids) if (!results.has(id)) results.set(id, 'refused');
  return results;
};

/**
 * Where a copy of opening `id` can go: right after it on its segment, else right
 * before it; null when neither fits.
 */
export const besideOpening = (plan: Plan, lib: OpeningLib, id: OpeningId): Vec2 | null => {
  const wall = plan.openings[id] && wallContext(plan, lib, plan.openings[id].wallId);
  const self = wall?.resolved.find((r) => r.id === id);
  if (!wall || !self || !isCut(self)) return null;
  const seg = wall.segs[self.segment];
  const width = self.def.width;
  for (const start of [self.start + width, self.start - width]) {
    const free =
      fits(start, width, wall.rangeOf(self.segment)) &&
      !findOverlap(wall.resolved, self.segment, start, width);
    if (seg && free) return pointAlong(seg, start + width / 2);
  }
  return null;
};
