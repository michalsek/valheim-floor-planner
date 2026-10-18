/**
 * What a pointer event is over, for the tools: the only seam that knows which view is
 * showing. Tools see the current level only (`levelView`): the work datum's objects.
 * In 2D it is the plan hit test at the event's world point. In 3D:
 *
 * 1. the selected wall's corner handles, by their on-screen distance;
 * 2. the nearest box along the pointer's ray (walls, openings and props win);
 * 3. on a floor, or on nothing, the plan hit test at the work-plane point (a floor's
 *    top is that plane), which brings dimensions, near misses and the floor tier.
 *
 * Pure TS against the derived boxes, never r3f raycasting (see Roadmap).
 */
import type { BoxMode } from '../model/geometry/box';
import { dot, pointAlong, runSegments, sideNormal } from '../model/geometry/polyline';
import { pickBoxes, pointOnRay } from '../model/geometry/ray';
import { snapToGrid } from '../model/geometry/snap';
import { hitItem, hitTest, itemsInBox, type Hit, type HitOptions } from '../model/hitTest';
import { boxFromCorners } from '../model/geometry/box';
import { boxCorners } from '../model/geometry/orient';
import { ITEM_KINDS } from '../model/itemKinds';
import { cutAway, ghostPlan, levelPlan } from '../model/levels';
import type { PieceBox } from '../model/pieceBoxes';
import { handleWallId, type SelectionItem } from '../model/selection';
import type { Plan, Vec2, Vec3, WallId } from '../model/types';
import { wallExtents } from '../model/wallGraph';
import { getLibrary } from '../store/libraryInstance';
import { getDerived, getPieceBoxes, getShownBoxes } from '../store/planHooks';
import { selectionAtom } from '../store/selection';
import {
  cutAwayAtom,
  effectiveSnapStepAtom,
  levelHoverAtom,
  projection3dAtom,
  roofsVisibleAtom,
  workDatumAtom,
} from '../store/session';
import { viewModeAtom } from '../store/view3d';
import { project3d, screenRay, workPlanePoint, type Projection3d } from '../viewport/projection3d';
import type { ScreenPoint } from '../viewport/viewportMath';

import { HANDLE_PX, hitTolerance, pxToMetres } from './hitTolerance';
import { itemsInScreenRect, screenRectFrom } from './Select/screenBoxSelect';
import type { ToolContext, ToolPointerEvent } from './types';

/**
 * A press that moves further than this (screen px) is a drag: more in 3D, where a few
 * pixels can be a long way.
 */
const DRAG_THRESHOLD_PX = { '2d': 3, '3d': 6 } as const;

/** The 3D camera, or null in 2D. */
const projectionOf = (ctx: ToolContext): Projection3d | null =>
  ctx.get(viewModeAtom) === '3d' ? ctx.get(projection3dAtom) : null;

export const dragThresholdPx = (ctx: ToolContext): number =>
  DRAG_THRESHOLD_PX[ctx.get(viewModeAtom)];

const roofless = new WeakMap<Plan, Plan>();

/** The plan without its roofs (kept per plan, so its derived data is too). */
const withoutRoofs = (plan: Plan): Plan => {
  if (Object.keys(plan.roofs).length === 0) return plan;
  let view = roofless.get(plan);
  if (!view) roofless.set(plan, (view = { ...plan, roofs: {} }));
  return view;
};

/**
 * The committed plan as the current level sees it: what tools pick and edit. Hidden
 * roofs aren't in it.
 */
export const levelView = (ctx: ToolContext): Plan => {
  const view = levelPlan(ctx.plan.getPlan(), ctx.get(workDatumAtom), getLibrary());
  return ctx.get(roofsVisibleAtom) ? view : withoutRoofs(view);
};

const hitOptions = (ctx: ToolContext, plan: Plan, handleTol: number): HitOptions => {
  const selection = ctx.get(selectionAtom);
  return {
    families: getLibrary().wallFamilies,
    propDefs: getLibrary().propDefs,
    rawLib: getLibrary(),
    openings: getDerived(plan).openings,
    handlesFor: handleTol > 0 ? handleWallId(selection) : null,
    handleTol,
    selection,
  };
};

const planHit = (ctx: ToolContext, p: Vec2, handleTol: number, plan = levelView(ctx)) =>
  hitTest(plan, p, hitTolerance(ctx), hitOptions(ctx, plan, handleTol));

/** The selected wall's corner nearest the pointer on screen, within `HANDLE_PX`. */
const handleAt = (ctx: ToolContext, e: ToolPointerEvent, v: Projection3d): Hit | null => {
  const wallId = handleWallId(ctx.get(selectionAtom));
  const run = wallId ? ctx.plan.getPlan().walls[wallId] : undefined;
  if (!run) return null;
  const y = run.elevation;
  let best: Hit | null = null;
  let bestDistance = HANDLE_PX;
  for (const [index, p] of run.points.entries()) {
    const s = project3d({ x: p.x, y, z: p.z }, v);
    const distance = s ? Math.hypot(s.x - e.screen.x, s.y - e.screen.y) : Infinity;
    if (distance <= bestDistance) {
      best = { kind: 'vertex', wallId: run.id, index };
      bestDistance = distance;
    }
  }
  return best;
};

/**
 * The nearest of `boxes` (the current level's by default) under a canvas point in 3D,
 * and where the ray enters it.
 */
const surfaceAt = (
  ctx: ToolContext,
  screen: ScreenPoint,
  boxes: readonly PieceBox[] = getPieceBoxes(levelView(ctx))
): { box: PieceBox; hit: Hit; point: Vec3 } | null => {
  const v = projectionOf(ctx);
  if (!v) return null;
  const ray = screenRay(screen, v);
  const found = pickBoxes(ray, boxes);
  return found && { box: found.box, hit: found.box.hit, point: pointOnRay(ray, found.t) };
};

/**
 * The nearest piece or prop box along the pointer's ray in 3D, and where the ray
 * enters it (M12 can snap roofs to wall tops with it); null in 2D or on a miss.
 */
export const pickSurface = (ctx: ToolContext, e: ToolPointerEvent) => surfaceAt(ctx, e.screen);

/**
 * In 3D, a world point for a canvas point whose ray misses the work plane but hits a
 * piece (a wall seen against the sky): the hit point's plan position. Null otherwise.
 */
export const surfacePlanPoint = (ctx: ToolContext, screen: ScreenPoint): Vec2 | null => {
  const surface = surfaceAt(ctx, screen);
  return surface && { x: surface.point.x, z: surface.point.z };
};

/**
 * What the event is over (as the 2D hit test reports it, vertex handles included), and
 * the height of the point grabbed on it: a piece's surface in 3D, else the work plane.
 * A move drags along the horizontal plane at that height, so a wall picked by its face
 * follows the pointer instead of the ground behind it.
 */
export const pickGrab = (ctx: ToolContext, e: ToolPointerEvent): { hit: Hit | null; y: number } => {
  const datum = ctx.get(workDatumAtom);
  const v = projectionOf(ctx);
  if (!v) return { hit: planHit(ctx, e.world, pxToMetres(ctx, HANDLE_PX)), y: datum };
  const handle = handleAt(ctx, e, v);
  if (handle) return { hit: handle, y: datum };
  const surface = pickSurface(ctx, e);
  if (surface && surface.hit.kind !== 'floor') return { hit: surface.hit, y: surface.point.y };
  return { hit: planHit(ctx, e.world, 0), y: datum };
};

/**
 * The event moved onto the horizontal plane at height `y` (snapped as the cursor is):
 * in 3D, where its ray meets that plane; in 2D, the event itself. Null when the ray
 * misses the plane.
 */
export const onPlaneAt = (
  ctx: ToolContext,
  e: ToolPointerEvent,
  y: number
): ToolPointerEvent | null => {
  const v = projectionOf(ctx);
  if (!v) return e;
  const world = workPlanePoint(e.screen, v, y);
  if (!world) return null;
  const snapped = e.altKey ? world : snapToGrid(world, ctx.get(effectiveSnapStepAtom));
  return { ...e, world, snapped };
};

/**
 * Items in a select box: in 2D, the world rectangle between its corners; in 3D, by
 * where their pieces are drawn inside the screen rectangle, from any camera direction.
 */
export const itemsInSelectBox = (
  ctx: ToolContext,
  world: { a: Vec2; b: Vec2 },
  screen: { a: ScreenPoint; b: ScreenPoint },
  mode: BoxMode
): SelectionItem[] => {
  const plan = levelView(ctx);
  const v = projectionOf(ctx);
  if (!v) return itemsInBox(plan, boxFromCorners(world.a, world.b), mode, getLibrary());
  const rect = screenRectFrom(screen.a, screen.b);
  return itemsInScreenRect(plan, getPieceBoxes(plan), v, rect, mode, getLibrary());
};

/** The wall and segment a wall or opening hit is on. */
const wallSegmentOf = (ctx: ToolContext, hit: Hit): { wallId: WallId; segment: number } | null => {
  if (hit.kind === 'wall') return { wallId: hit.id, segment: hit.segment };
  if (hit.kind !== 'opening') return null;
  const opening = getDerived(levelView(ctx)).openings.find((o) => o.id === hit.id);
  return opening && opening.segment !== null
    ? { wallId: opening.wallId, segment: opening.segment }
    : null;
};

/**
 * The plan point to place an opening from. In 3D, a wall (or opening) under the ray
 * gives the point on that segment's footprint middle under the hit, so a wall seen
 * edge-on takes the opening rather than the ground behind it; otherwise the event's
 * world point.
 */
export const pickWallPoint = (ctx: ToolContext, e: ToolPointerEvent): Vec2 => {
  const surface = pickSurface(ctx, e);
  const on = surface && wallSegmentOf(ctx, surface.hit);
  if (!surface || !on) return e.world;
  const run = ctx.plan.getPlan().walls[on.wallId];
  const seg = run && runSegments(run)[on.segment];
  if (!run || !seg) return e.world;
  const family = getLibrary().wallFamilies.get(run.familyId);
  const { left, right } = family ? wallExtents(run.side, family) : { left: 0, right: 0 };
  const rel = { x: surface.point.x - seg.a.x, z: surface.point.z - seg.a.z };
  const along = Math.min(Math.max(dot(rel, seg.dir), 0), seg.length);
  const onLine = pointAlong(seg, along);
  const normal = sideNormal(seg.dir, 'right');
  const middle = (right - left) / 2;
  return { x: onLine.x + normal.x * middle, z: onLine.z + normal.z * middle };
};

/** The height of a box's top (a tilted roof slab's highest corner). */
const boxTop = (box: PieceBox): number => Math.max(...boxCorners(box).map((c) => c.y));

/** The top of an item: its highest box, or (a dimension) its elevation. */
const itemTop = (plan: Plan, item: SelectionItem): number | null => {
  const tops = getPieceBoxes(plan)
    .filter((box) => box.item.kind === item.kind && box.item.id === item.id)
    .map(boxTop);
  return tops.length > 0 ? Math.max(...tops) : ITEM_KINDS[item.kind].elevation(plan, item.id);
};

/** The boxes the 3D view draws: the shown ones, and the cut-away of them when on. */
const drawnBoxes = (ctx: ToolContext, plan: Plan): readonly PieceBox[] => {
  const boxes = getShownBoxes(plan, ctx.get(roofsVisibleAtom));
  if (!ctx.get(cutAwayAtom)) return boxes;
  const options = { datum: ctx.get(workDatumAtom), hovered: ctx.get(levelHoverAtom) };
  return cutAway(boxes, plan, getLibrary(), options);
};

/**
 * The height of the top of the piece under the event, for the Levels bar's Pick: in 3D
 * whatever drawn piece the ray meets first, on any level; in 2D the current level's,
 * else a ghost from the level below. Null over nothing.
 */
export const pickTop = (
  ctx: ToolContext,
  screen: ScreenPoint,
  world: Vec2 | null
): number | null => {
  const plan = ctx.plan.getPlan();
  if (projectionOf(ctx)) {
    const surface = surfaceAt(ctx, screen, drawnBoxes(ctx, plan));
    return surface && boxTop(surface.box);
  }
  if (!world) return null;
  const datum = ctx.get(workDatumAtom);
  for (const view of [levelPlan(plan, datum, getLibrary()), ghostPlan(plan, datum, getLibrary())]) {
    const hit = planHit(ctx, world, 0, view);
    if (hit) return itemTop(plan, hitItem(hit));
  }
  return null;
};
