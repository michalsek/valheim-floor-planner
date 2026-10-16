import { pointInBox } from '../../model/geometry/box';
import { underlayRect } from '../../model/underlay';
import { editPreviewAtom } from '../../store/selection';
import { underlayVisibleAtom, viewportAtom } from '../../store/session';
import { isUndoKey } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext, ToolPointerEvent } from '../types';

import { cancelUnderlayGesture } from './underlayActions';
import { UnderlayIcon } from './UnderlayIcon';
import { UnderlayOptions } from './UnderlayOptions';
import { UnderlayPreview } from './UnderlayPreview';
import { underlayGestureAtom, underlayHintAtom } from './underlayState';

/** A second calibration point closer than this (screen px) to the first is ignored. */
const MIN_CALIB_PX = 4;

const onDown = (e: ToolPointerEvent, ctx: ToolContext): void => {
  const g = ctx.get(underlayGestureAtom);
  const underlay = ctx.plan.getPlan().underlay;
  if (!underlay) return;
  // Moving or calibrating an image you can't see would be guesswork (the options bar
  // says why nothing happens).
  if (!ctx.get(underlayVisibleAtom)) return;
  if (g.phase === 'calibA') {
    ctx.set(underlayGestureAtom, { phase: 'calibB', a: e.world });
    ctx.set(underlayHintAtom, null);
    return;
  }
  if (g.phase === 'calibB') {
    const px = Math.hypot(e.world.x - g.a.x, e.world.z - g.a.z) * ctx.get(viewportAtom).zoom;
    if (px < MIN_CALIB_PX) {
      ctx.set(underlayHintAtom, 'Pick a different point');
      return;
    }
    ctx.set(underlayGestureAtom, { phase: 'calibDistance', a: g.a, b: e.world });
    ctx.set(underlayHintAtom, null);
    return;
  }
  if (g.phase === 'idle' && !underlay.locked && pointInBox(e.world, underlayRect(underlay))) {
    ctx.set(underlayGestureAtom, { phase: 'dragging', start: e.world, origin0: underlay.origin });
  }
};

const onMove = (e: ToolPointerEvent, ctx: ToolContext): void => {
  const g = ctx.get(underlayGestureAtom);
  if (g.phase !== 'dragging') return;
  // Free moves: the image's own grid rarely sits on ours until calibrated.
  const origin = {
    x: g.origin0.x + e.world.x - g.start.x,
    z: g.origin0.z + e.world.z - g.start.z,
  };
  ctx.set(editPreviewAtom, [{ type: 'underlay.patch', changes: { origin } }]);
};

/**
 * Drag the (unlocked, shown) image to move it. Calibrate from the options bar: click two
 * points a known distance apart, then type the distance. Esc cancels.
 */
export const underlayTool: Tool = {
  id: 'underlay',
  label: 'Underlay',
  shortcut: 'u',
  icon: UnderlayIcon,
  cursor: 'crosshair',
  // The image isn't drawn in 3D, and calibrating needs pixel-exact clicks on it.
  in3d: false,
  onPointerDown(e, ctx) {
    if (e.button === PRIMARY_BUTTON) onDown(e, ctx);
  },
  onPointerMove: onMove,
  onPointerUp(_e, ctx) {
    if (ctx.get(underlayGestureAtom).phase !== 'dragging') return;
    const preview = ctx.get(editPreviewAtom);
    cancelUnderlayGesture(ctx);
    if (preview) ctx.plan.transact('Move underlay', (dispatch) => preview.forEach(dispatch));
  },
  onPointerCancel(ctx) {
    if (ctx.get(underlayGestureAtom).phase === 'dragging') cancelUnderlayGesture(ctx);
  },
  onKeyDown(e, ctx) {
    if (e.key === 'Escape' || isUndoKey(e)) return cancelUnderlayGesture(ctx);
    return false;
  },
  onDeactivate: cancelUnderlayGesture,
  Preview: UnderlayPreview,
  Options: UnderlayOptions,
};
