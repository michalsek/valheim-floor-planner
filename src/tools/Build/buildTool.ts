import { setPieces, setSnaps } from '../../model/build/ghostSet';
import { ROTATION_STEP, stepManual } from '../../model/build/placement';
import { normalizeDeg } from '../../model/geometry/propGeometry';
import { newId } from '../../model/newId';
import { getLibrary } from '../../store/libraryInstance';
import { workDatumAtom } from '../../store/session';
import { isMod, rotateStep } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool, ToolContext } from '../types';

import { buildGhostAtom, buildHidesCursorAtom, buildRemovalAtom } from './buildGhost';
import { pieceName } from './buildLabel';
import { BuildIcon } from './BuildIcon';
import { BuildOptions } from './BuildOptions';
import { BuildOverlay3d } from './BuildOverlay3d';
import { BuildPreview } from './BuildPreview';
import { BuildPreview3d } from './BuildPreview3d';
import { armedSetAtom, buildYawAtom, carriedCopiesAtom, manualSnapAtom } from './buildState';
import { wheelSteps } from './buildWheel';

/** Places the ghost's pieces as one undo entry; nothing when blocked or without a ghost. */
const place = (ctx: ToolContext): void => {
  const ghost = ctx.get(buildGhostAtom);
  if (!ghost || ghost.blockedBy) return;
  const pieces = setPieces(ghost.set, ghost.pose, ctx.get(workDatumAtom));
  const label =
    pieces.length === 1 ? `Place ${pieceName(pieces[0]!.prefab)}` : `Place ${pieces.length} pieces`;
  const result = ctx.plan.transact(label, (dispatch) => {
    for (const piece of pieces) dispatch({ type: 'raw.insert', piece: { id: newId(), ...piece } });
  });
  if (!result.ok) console.warn(`${label} failed.`, result.error);
};

/** Removes the raw piece or prop under the pointer (Ctrl/⌘ + click) as one undo entry. */
const remove = (ctx: ToolContext): void => {
  const removal = ctx.get(buildRemovalAtom);
  if (!removal?.removable) return;
  const { box } = removal;
  const label = `Remove ${pieceName(box.prefab)}`;
  const { kind, id } = box.item;
  const result = ctx.plan.transact(label, (dispatch) => {
    if (kind === 'raw') dispatch({ type: 'raw.remove', id });
    else if (kind === 'prop') dispatch({ type: 'prop.remove', id });
  });
  if (!result.ok) console.warn(`${label} failed.`, result.error);
};

const press = (ctx: ToolContext, button: number): void => {
  if (button !== PRIMARY_BUTTON) return;
  if (ctx.get(buildRemovalAtom)) remove(ctx);
  else place(ctx);
};

const turn = (ctx: ToolContext, degrees: number): void =>
  ctx.set(buildYawAtom, (yaw) => normalizeDeg(yaw + degrees));

const ORIGIN_POSE = { pivot: { x: 0, y: 0, z: 0 }, yaw: 0 };

/** Wheel travel not yet turned into a step. */
let wheelRest = 0;

/**
 * Builds single game pieces (raw pieces) the way the game does (M17 §2): the armed
 * piece's ghost follows the ray onto pieces, the ground or the level plate and snaps to
 * the nearest pair of snap points; a click places it (the tool stays armed). The wheel
 * turns it 22.5° a notch (up is clockwise), R / Shift+R 90° / 22.5°; Q / E pick the snap
 * point (auto → 1 … n → auto); Shift or Alt places freely; Ctrl/⌘ + click removes a raw
 * piece or item. Esc disarms; with nothing armed (or copies carried from Select) it goes
 * back to Select.
 */
export const buildTool: Tool = {
  id: 'build',
  label: 'Build',
  shortcut: 'h',
  icon: BuildIcon,
  cursor: 'crosshair',
  hidesCursor: buildHidesCursorAtom,
  onActivate() {
    wheelRest = 0;
  },
  onPointerDown(e, ctx) {
    press(ctx, e.button);
  },
  onPointerMiss(e, ctx) {
    // A terrain-only hit has no work-plane point, but the ghost is there.
    press(ctx, e.button);
  },
  onWheel(e, ctx) {
    if (!ctx.get(armedSetAtom)) return false;
    const { steps, rest } = wheelSteps(wheelRest, e);
    wheelRest = rest;
    if (steps !== 0) turn(ctx, steps * ROTATION_STEP);
    return true;
  },
  onKeyDown(e, ctx) {
    const set = ctx.get(armedSetAtom);
    const step = rotateStep(e);
    if (step !== null && set) {
      turn(ctx, step);
      return true;
    }
    const key = e.key.toLowerCase();
    if ((key === 'q' || key === 'e') && set && !isMod(e) && !e.altKey) {
      const count = setSnaps(set, ORIGIN_POSE, getLibrary()).length;
      if (count > 0) ctx.set(manualSnapAtom, (m) => stepManual(m, count, key === 'e' ? 1 : -1));
      return true;
    }
    if (e.key === 'Escape' && set) {
      // Copies carried from Select go back to it (`useToolKeyboard`); a piece stays in Build.
      const copies = ctx.get(carriedCopiesAtom);
      ctx.set(armedSetAtom, null);
      return !copies;
    }
    return false;
  },
  Preview: BuildPreview,
  Preview3d: BuildPreview3d,
  Overlay3d: BuildOverlay3d,
  Options: BuildOptions,
};
