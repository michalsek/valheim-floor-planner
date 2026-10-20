/**
 * What a pointer event is over, for the tools: the only seam that knows which view is
 * showing. Tools see only what the cut shows (`cutView`); a ghost above the cut is never
 * picked. In 2D it is the plan hit test at the event's world point. In 3D:
 *
 * 1. the nearest box along the pointer's ray (raw pieces and props);
 * 2. on nothing, a dimension hit at its own height (where the ray meets its plane);
 * 3. else the plan hit test at the event's surface point (near misses).
 *
 * Pure TS against the plan's boxes, never r3f raycasting (see Roadmap).
 */
import type { BoxMode } from '../model/geometry/box';
import { pickBoxes, pointOnRay } from '../model/geometry/ray';
import { snapToGrid } from '../model/geometry/snap';
import { hitDimension, hitTest, itemsInBox, type Hit, type HitOptions } from '../model/hitTest';
import { boxFromCorners } from '../model/geometry/box';
import type { PieceBox } from '../model/pieceBoxes';
import { isRawRoofCover } from '../model/rawBoxes';
import type { SelectionItem } from '../model/selection';
import type { DimId, Plan, Vec2, Vec3 } from '../model/types';
import { getLibrary } from '../store/libraryInstance';
import { getCutPlan, getDrawnBoxes, getPieceBoxes } from '../store/planHooks';
import { pointerRay } from '../store/pointer';
import { selectionAtom } from '../store/selection';
import { cutHeightAtom, projection3dAtom, roofsVisibleAtom, snapStepAtom } from '../store/session';
import { viewModeAtom } from '../store/view3d';
import { planePointAt, type Projection3d } from '../viewport/projection3d';
import type { ScreenPoint } from '../viewport/viewportMath';

import { HIT_TOL_PX, hitTolerance, pxToMetresAt } from './hitTolerance';
import { itemsInScreenRect, screenRectFrom } from './Select/screenBoxSelect';
import type { OffPlanePointerEvent, ToolContext, ToolPointerEvent } from './types';

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

/** The plan without its roof covers (kept per plan, so its boxes are too). */
const withoutRoofs = (plan: Plan): Plan => {
  let view = roofless.get(plan);
  if (!view) {
    const lib = getLibrary();
    const raw = Object.values(plan.rawPieces);
    const kept = raw.filter((piece) => !isRawRoofCover(piece, lib));
    const bare = kept.length === raw.length;
    const rawPieces = bare ? plan.rawPieces : Object.fromEntries(kept.map((p) => [p.id, p]));
    view = bare ? plan : { ...plan, rawPieces };
    roofless.set(plan, view);
  }
  return view;
};

/**
 * The committed plan as the cut shows it: what tools pick and edit. Hidden roof covers
 * aren't in it.
 */
export const cutView = (ctx: ToolContext): Plan => {
  const view = getCutPlan(ctx.plan.getPlan(), ctx.get(cutHeightAtom));
  return ctx.get(roofsVisibleAtom) ? view : withoutRoofs(view);
};

const hitOptions = (ctx: ToolContext): HitOptions => ({
  propDefs: getLibrary().propDefs,
  rawLib: getLibrary(),
  selection: ctx.get(selectionAtom),
});

const planHit = (ctx: ToolContext, p: Vec2, plan = cutView(ctx)) =>
  hitTest(plan, p, hitTolerance(ctx), hitOptions(ctx));

/**
 * The nearest drawn piece or prop box along the pointer's ray in 3D (within its reach,
 * `pointerRay`), and where the ray enters it; null in 2D or on a miss.
 */
export const pickSurface = (
  ctx: ToolContext,
  e: ToolPointerEvent
): { box: PieceBox; hit: Hit; point: Vec3 } | null => {
  const pointer = projectionOf(ctx) && pointerRay(ctx.get, e.screen);
  if (!pointer) return null;
  const boxes = getDrawnBoxes(
    ctx.plan.getPlan(),
    ctx.get(roofsVisibleAtom),
    ctx.get(cutHeightAtom)
  );
  const found = pickBoxes(pointer.ray, boxes);
  if (!found || found.t > pointer.maxT) return null;
  return { box: found.box, hit: found.box.hit, point: pointOnRay(pointer.ray, found.t) };
};

/**
 * The shown dimension under the pointer: in 2D the nearest to the event's point; in 3D
 * the nearest where the pointer's ray meets its own plane (its elevation), each within
 * the hit tolerance at that point.
 */
export const pickDimension = (
  ctx: ToolContext,
  e: ToolPointerEvent
): { id: DimId; distance: number; elevation: number } | null => {
  const { dimensions } = cutView(ctx);
  const v = projectionOf(ctx);
  if (!v) {
    const hit = hitDimension(dimensions, e.world, hitTolerance(ctx));
    return hit && { ...hit, elevation: dimensions[hit.id]?.elevation ?? 0 };
  }
  let best: { id: DimId; distance: number; elevation: number; px: number } | null = null;
  for (const dim of Object.values(dimensions)) {
    const p = planePointAt(e.screen, v, dim.elevation);
    if (!p) continue;
    const tol = pxToMetresAt(ctx, HIT_TOL_PX, { x: p.x, y: dim.elevation, z: p.z });
    const hit = hitDimension({ [dim.id]: dim }, p, tol);
    // Each is measured on its own plane, so they are compared in screen px.
    const px = hit ? (hit.distance / tol) * HIT_TOL_PX : Infinity;
    if (hit && (!best || px < best.px)) best = { ...hit, elevation: dim.elevation, px };
  }
  return best && { id: best.id, distance: best.distance, elevation: best.elevation };
};

/**
 * What the event is over (as the 2D hit test reports it), and the height of the point
 * grabbed on it: in 3D a piece's surface, else a dimension's height; otherwise the
 * surface under the pointer. A move drags along the horizontal plane at that height, so
 * a wall picked by its face follows the pointer instead of the ground behind it.
 */
export const pickGrab = (ctx: ToolContext, e: ToolPointerEvent): { hit: Hit | null; y: number } => {
  if (!projectionOf(ctx)) return { hit: planHit(ctx, e.world), y: e.y };
  const surface = pickSurface(ctx, e);
  if (surface) return { hit: surface.hit, y: surface.point.y };
  const dimension = pickDimension(ctx, e);
  if (dimension) {
    const { id, distance, elevation } = dimension;
    return { hit: { kind: 'dimension', id, distance }, y: elevation };
  }
  return { hit: planHit(ctx, e.world), y: e.y };
};

/**
 * The event moved onto the horizontal plane at height `y` (snapped as the cursor is, and
 * with that `y`): in 3D, where its ray meets that plane, also for an event with no world
 * point (a press over the sky); in 2D, the event itself. Null when the ray misses the
 * plane.
 */
export const onPlaneAt = (
  ctx: ToolContext,
  e: ToolPointerEvent | OffPlanePointerEvent,
  y: number
): ToolPointerEvent | null => {
  const v = projectionOf(ctx);
  if (!v) return 'world' in e ? { ...e, y } : null;
  const world = planePointAt(e.screen, v, y);
  if (!world) return null;
  const snapped = e.altKey ? world : snapToGrid(world, ctx.get(snapStepAtom));
  return { ...e, world, snapped, y };
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
  const plan = cutView(ctx);
  const v = projectionOf(ctx);
  if (!v) return itemsInBox(plan, boxFromCorners(world.a, world.b), mode, getLibrary());
  const rect = screenRectFrom(screen.a, screen.b);
  return itemsInScreenRect(plan, getPieceBoxes(plan), v, rect, mode, getLibrary());
};
