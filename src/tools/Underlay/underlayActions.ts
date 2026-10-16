/** Underlay edits shared by the Underlay tool and its options bar. */
import { snapToGrid } from '../../model/geometry/snap';
import { newId } from '../../model/newId';
import type { Underlay, Vec2 } from '../../model/types';
import { calibrate, clampMetresPerPixel } from '../../model/underlay';
import { putImage } from '../../store/imageStore';
import { prepareImage } from '../../store/prepareImage';
import { editPreviewAtom } from '../../store/selection';
import {
  snapStepAtom,
  underlayVisibleAtom,
  viewportAtom,
  viewportSizeAtom,
} from '../../store/session';
import { visibleWorldRect } from '../../viewport/viewportMath';
import type { ToolContext } from '../types';

import {
  snapAnchorAtom,
  UNDERLAY_IDLE,
  underlayGestureAtom,
  underlayHintAtom,
} from './underlayState';

/** A new image covers this share of the visible width, until calibrated. */
const INITIAL_FIT = 0.8;
/** Faint enough that walls traced over it stand out. */
const INITIAL_OPACITY = 0.25;

/** Ends any gesture and drops its preview and hint; false when there was none. */
export const cancelUnderlayGesture = (ctx: ToolContext): boolean => {
  const busy = ctx.get(underlayGestureAtom).phase !== 'idle';
  ctx.set(underlayGestureAtom, UNDERLAY_IDLE);
  ctx.set(editPreviewAtom, null);
  ctx.set(underlayHintAtom, null);
  return busy;
};

/** A fresh underlay for an image, fitted to and centred in the view. */
const fittedUnderlay = (
  ctx: ToolContext,
  image: Pick<Underlay, 'imageId' | 'name' | 'pixelSize'>
): Underlay => {
  const view = visibleWorldRect(ctx.get(viewportAtom), ctx.get(viewportSizeAtom));
  const viewWidth = view.max.x - view.min.x;
  const metresPerPixel = clampMetresPerPixel((viewWidth * INITIAL_FIT) / image.pixelSize.w);
  const centre = { x: (view.min.x + view.max.x) / 2, z: (view.min.z + view.max.z) / 2 };
  const origin = {
    x: centre.x - (image.pixelSize.w * metresPerPixel) / 2,
    z: centre.z - (image.pixelSize.h * metresPerPixel) / 2,
  };
  return { ...image, origin, metresPerPixel, opacity: INITIAL_OPACITY, locked: false };
};

/**
 * Stores the image and puts it under the plan. Relinking (there is an underlay
 * already) keeps its place, scale, opacity and lock. Rejects with a user message.
 */
export const loadUnderlayImage = async (ctx: ToolContext, file: File): Promise<void> => {
  const { blob, width, height } = await prepareImage(file);
  const imageId = newId();
  await putImage(imageId, blob);
  const image = { imageId, name: file.name, pixelSize: { w: width, h: height } };
  const current = ctx.plan.getPlan().underlay;
  const underlay = current ? { ...current, ...image } : fittedUnderlay(ctx, image);
  const label = current ? 'Relink underlay' : 'Add underlay';
  ctx.plan.dispatch({ type: 'underlay.set', underlay }, { label });
  ctx.set(underlayVisibleAtom, true);
};

/**
 * Applies the calibration: A to B is `metres`, then A optionally snaps to the grid.
 * A scale out of range leaves the underlay alone and says so in the hint.
 */
export const applyCalibration = (ctx: ToolContext, a: Vec2, b: Vec2, metres: number): boolean => {
  const underlay = ctx.plan.getPlan().underlay;
  if (!underlay) return false;
  const result = calibrate(underlay, a, b, metres);
  if (!result) {
    ctx.set(underlayHintAtom, 'Scale out of range');
    return false;
  }
  let { origin } = result;
  if (ctx.get(snapAnchorAtom)) {
    const target = snapToGrid(a, ctx.get(snapStepAtom));
    origin = { x: origin.x + target.x - a.x, z: origin.z + target.z - a.z };
  }
  ctx.plan.dispatch(
    { type: 'underlay.patch', changes: { ...result, origin } },
    { label: 'Calibrate underlay' }
  );
  cancelUnderlayGesture(ctx);
  return true;
};
