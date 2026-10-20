/**
 * What a pointer event is over, for the tools: the only seam that knows which view is
 * showing. Tools see only what the cut shows (`cutView`); a ghost above the cut is never
 * picked. In 2D it is the plan hit test at the event's world point. In 3D:
 *
 * 1. the nearest box along the pointer's ray (raw pieces and props);
 * 2. on nothing, the plan hit test at the work-plane point, which brings dimensions
 *    and near misses.
 *
 * Pure TS against the plan's boxes, never r3f raycasting (see Roadmap).
 */
import type { BoxMode } from '../model/geometry/box';
import { pickBoxes, pointOnRay } from '../model/geometry/ray';
import { snapToGrid } from '../model/geometry/snap';
import { hitTest, itemsInBox, type Hit, type HitOptions } from '../model/hitTest';
import { boxFromCorners } from '../model/geometry/box';
import { cutBoxes } from '../model/cut';
import type { PieceBox } from '../model/pieceBoxes';
import { isRawRoofCover } from '../model/rawBoxes';
import type { SelectionItem } from '../model/selection';
import type { Plan, Vec2, Vec3 } from '../model/types';
import { getLibrary } from '../store/libraryInstance';
import { getCutPlan, getPieceBoxes, getShownBoxes } from '../store/planHooks';
import { selectionAtom } from '../store/selection';
import {
  cutHeightAtom,
  projection3dAtom,
  roofsVisibleAtom,
  snapStepAtom,
  workPlaneAtom,
  type SessionAccess,
} from '../store/session';
import { viewModeAtom } from '../store/view3d';
import { screenRay, workPlanePoint, type Projection3d } from '../viewport/projection3d';
import type { ScreenPoint } from '../viewport/viewportMath';

import { hitTolerance } from './hitTolerance';
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
 * The nearest of `boxes` (the drawn ones by default) under a canvas point in 3D, and
 * where the ray enters it.
 */
const surfaceAt = (
  ctx: ToolContext,
  screen: ScreenPoint,
  boxes: readonly PieceBox[] = drawnBoxes(ctx, ctx.plan.getPlan())
): { box: PieceBox; hit: Hit; point: Vec3 } | null => {
  const v = projectionOf(ctx);
  if (!v) return null;
  const ray = screenRay(screen, v);
  const found = pickBoxes(ray, boxes);
  return found && { box: found.box, hit: found.box.hit, point: pointOnRay(ray, found.t) };
};

/**
 * The nearest piece or prop box along the pointer's ray in 3D, and where the ray
 * enters it; null in 2D or on a miss.
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
 * What the event is over (as the 2D hit test reports it), and the height of the point
 * grabbed on it: a piece's surface in 3D, else the work plane. A move drags along the
 * horizontal plane at that height, so a wall picked by its face follows the pointer
 * instead of the ground behind it.
 */
export const pickGrab = (ctx: ToolContext, e: ToolPointerEvent): { hit: Hit | null; y: number } => {
  const plane = ctx.get(workPlaneAtom);
  if (!projectionOf(ctx)) return { hit: planHit(ctx, e.world), y: plane };
  const surface = pickSurface(ctx, e);
  if (surface) return { hit: surface.hit, y: surface.point.y };
  return { hit: planHit(ctx, e.world), y: plane };
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
  const snapped = e.altKey ? world : snapToGrid(world, ctx.get(snapStepAtom));
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
  const plan = cutView(ctx);
  const v = projectionOf(ctx);
  if (!v) return itemsInBox(plan, boxFromCorners(world.a, world.b), mode, getLibrary());
  const rect = screenRectFrom(screen.a, screen.b);
  return itemsInScreenRect(plan, getPieceBoxes(plan), v, rect, mode, getLibrary());
};

/**
 * The boxes the views draw and tools hit: the shown ones the cut keeps. Takes only `get`,
 * so derived atoms can use it too.
 */
export const drawnBoxes = ({ get }: Pick<SessionAccess, 'get'>, plan: Plan): readonly PieceBox[] =>
  cutBoxes(getShownBoxes(plan, get(roofsVisibleAtom)), get(cutHeightAtom));
