/**
 * The sink handle's pointer side (3D only): where it is on screen, the press that grabs
 * it, the drag (previewed in `editPreviewAtom`) and the hover.
 */
import { itemsLabel } from '../../model/selection';
import type { Vec3 } from '../../model/types';
import { editPreviewAtom, selectionAtom } from '../../store/selection';
import { cutStepAtom, projection3dAtom } from '../../store/session';
import { viewModeAtom } from '../../store/view3d';
import { project3d, type Projection3d } from '../../viewport/projection3d';
import type { ScreenPoint } from '../../viewport/viewportMath';
import { dragThresholdPx } from '../picking';
import type { ToolContext, ToolPointerEvent } from '../types';

import { commitCommands } from '../commitCommands';
import type { SelectGesture } from './selectState';
import { FINE_STEP, handleTop, sinkCommands, sinkTargets } from './sinkHandle';

type Sinking = Extract<SelectGesture, { phase: 'sinking' }>;

/** The handle sits this far (px) over the top of the item it sinks. */
export const SINK_LIFT_PX = 26;
/** Presses this close (px) to the handle's centre grab it. */
export const SINK_HIT_PX = 13;

/** The handle's centre on screen for a target's top; null behind the camera. */
export const sinkHandleAt = (top: Vec3, v: Projection3d): ScreenPoint | null => {
  const p = project3d(top, v);
  return p && { x: p.x, y: p.y - SINK_LIFT_PX };
};

/** The sink targets and camera when the press or hover is on the handle (3D only). */
const onHandle = (ctx: ToolContext, screen: ScreenPoint) => {
  const v = ctx.get(projection3dAtom);
  if (ctx.get(viewModeAtom) !== '3d' || !v) return null;
  const targets = sinkTargets(ctx.plan.getPlan(), ctx.get(selectionAtom));
  const top = handleTop(targets);
  const at = top && sinkHandleAt(top, v);
  if (!at || Math.hypot(at.x - screen.x, at.y - screen.y) > SINK_HIT_PX) return null;
  return { targets, v };
};

export const overSinkHandle = (ctx: ToolContext, screen: ScreenPoint): boolean =>
  onHandle(ctx, screen) !== null;

/** Screen px per metre straight up at the handle (at least 1). */
const verticalScale = (top: Vec3, v: Projection3d): number => {
  const a = project3d(top, v);
  const b = project3d({ ...top, y: top.y - 1 }, v);
  return a && b ? Math.max(1, Math.abs(b.y - a.y)) : 1;
};

/** A press on the handle starts a sink drag; null when it isn't on the handle. */
export const pressSinkHandle = (ctx: ToolContext, e: ToolPointerEvent): Sinking | null => {
  const on = onHandle(ctx, e.screen);
  if (!on) return null;
  const first = on.targets[0]!;
  return {
    phase: 'sinking',
    targets: on.targets,
    startY: e.screen.y,
    pxPerMetre: verticalScale(handleTop(on.targets)!, on.v),
    depth: first.depth,
  };
};

/**
 * Follows the pointer: down sinks, up raises back to the ground (no further). Within the
 * drag threshold nothing moves, so a click on the handle changes nothing.
 */
export const dragSink = (
  ctx: ToolContext,
  g: Sinking,
  e: Pick<ToolPointerEvent, 'screen' | 'shiftKey'>
): Sinking => {
  const dy = e.screen.y - g.startY;
  if (Math.abs(dy) <= dragThresholdPx(ctx)) {
    ctx.set(editPreviewAtom, null);
    return { ...g, depth: g.targets[0]?.depth ?? g.depth };
  }
  const metres = -dy / g.pxPerMetre;
  const step = e.shiftKey ? FINE_STEP : ctx.get(cutStepAtom);
  const { cmds, depth } = sinkCommands(ctx.plan.getPlan(), g.targets, metres, step);
  ctx.set(editPreviewAtom, cmds.length > 0 ? cmds : null);
  return { ...g, depth };
};

/** The release: one entry, "Sink …" or "Raise …". */
export const commitSink = (ctx: ToolContext, g: Sinking): void => {
  const first = g.targets[0];
  const verb = first && g.depth > first.depth ? 'Raise' : 'Sink';
  const items = g.targets.map((t) => t.item);
  commitCommands(ctx, itemsLabel(verb, items), ctx.get(editPreviewAtom) ?? []);
};
