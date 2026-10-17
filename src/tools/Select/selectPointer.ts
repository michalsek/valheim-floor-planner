/**
 * The Select tool's pointer state machine: press, then either a click (select), a
 * move of the selection, a corner drag or a box select. Moves and corner drags are
 * previewed through `editPreviewAtom` and committed on release as one history entry.
 */
import { refusedSlides, translateCommands, vertexDragCommands } from '../../model/editCommands';
import { hitItem } from '../../model/hitTest';
import { isSelected, itemsLabel, toggleItem, unionItems } from '../../model/selection';
import { snapValue } from '../../model/geometry/snap';
import type { Vec2 } from '../../model/types';
import { clampVertexTarget } from '../../model/vertexDrag';
import { getLibrary } from '../../store/libraryInstance';
import { editPreviewAtom, hoverAtom, selectionAtom } from '../../store/selection';
import { cursorStyleAtom, snapStepAtom, workDatumAtom } from '../../store/session';
import { dragThresholdPx, itemsInSelectBox, onPlaneAt, pickGrab } from '../picking';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { ToolContext, ToolPointerEvent } from '../types';

import { anchoredDelta, anchorOf, commitCommands, moveStep } from './selectActions';
import {
  boxMode,
  SELECT_IDLE,
  selectGestureAtom,
  type Grab,
  type SelectGesture,
} from './selectState';

type Gesture<P extends SelectGesture['phase']> = Extract<SelectGesture, { phase: P }>;

const updateHover = (ctx: ToolContext, e: ToolPointerEvent): void => {
  const { hit } = pickGrab(ctx, e);
  ctx.set(hoverAtom, hit);
  ctx.set(cursorStyleAtom, hit ? (hit.kind === 'vertex' ? 'grab' : 'move') : null);
};

const finish = (ctx: ToolContext): void => {
  ctx.set(selectGestureAtom, SELECT_IDLE);
  ctx.set(editPreviewAtom, null);
};

/** Abandons the gesture and its preview; false when there was none. */
export const cancelGesture = (ctx: ToolContext): boolean => {
  if (ctx.get(selectGestureAtom).phase === 'idle') return false;
  finish(ctx);
  ctx.set(cursorStyleAtom, null);
  return true;
};

/** The press on the plane at the grabbed height (on the work plane where that misses). */
const grabOf = (ctx: ToolContext, e: ToolPointerEvent, y: number): Grab => {
  const on = onPlaneAt(ctx, e, y);
  if (on) return { y, world: on.world, snapped: on.snapped };
  return { y: ctx.get(workDatumAtom), world: e.world, snapped: e.snapped };
};

export const onSelectDown = (e: ToolPointerEvent, ctx: ToolContext): void => {
  if (e.button !== PRIMARY_BUTTON) return;
  const { hit, y } = pickGrab(ctx, e);
  const selection = ctx.get(selectionAtom);
  // Select on press, so press-and-drag moves an unselected item in one gesture.
  const item = hit && hit.kind !== 'vertex' ? hitItem(hit) : null;
  const addedOnDown = item !== null && !isSelected(selection, item);
  if (item && addedOnDown) ctx.set(selectionAtom, e.shiftKey ? [...selection, item] : [item]);
  ctx.set(selectGestureAtom, {
    phase: 'pressing',
    startScreen: e.screen,
    startWorld: e.world,
    grab: grabOf(ctx, e, y),
    hit,
    shift: e.shiftKey,
    addedOnDown,
  });
};

/** The drag a press turns into once it passes the threshold. */
const startDrag = (ctx: ToolContext, press: Gesture<'pressing'>): SelectGesture => {
  ctx.set(hoverAtom, null);
  const { hit, startWorld, grab } = press;
  if (hit?.kind === 'vertex') {
    const run = ctx.plan.getPlan().walls[hit.wallId];
    const corner = run?.points[hit.index];
    if (run && corner) {
      ctx.set(cursorStyleAtom, 'grabbing');
      return { phase: 'vertex', run, index: hit.index, target: corner };
    }
  }
  if (hit) {
    ctx.set(cursorStyleAtom, 'move');
    const anchor = anchorOf(ctx.plan.getPlan(), hitItem(hit));
    return { phase: 'moving', grab, items: ctx.get(selectionAtom), anchor };
  }
  ctx.set(cursorStyleAtom, null);
  const { startScreen } = press;
  return {
    phase: 'box',
    startWorld,
    currentWorld: startWorld,
    startScreen,
    currentScreen: startScreen,
    additive: press.shift,
  };
};

/**
 * Snapped moves keep an off-grid object's offset (in whole metres when floors or
 * openings move), but a grabbed pole or beam lands its anchor on the grid; with Alt (no
 * snapping) the raw delta.
 */
const moveDelta = (ctx: ToolContext, g: Gesture<'moving'>, e: ToolPointerEvent): Vec2 => {
  const { world, snapped } = g.grab;
  if (e.altKey) return { x: e.snapped.x - world.x, z: e.snapped.z - world.z };
  const step = moveStep(g.items, ctx.get(snapStepAtom));
  if (g.anchor)
    return anchoredDelta(g.anchor, { x: e.world.x - world.x, z: e.world.z - world.z }, step);
  return {
    x: snapValue(e.snapped.x - snapped.x, step),
    z: snapValue(e.snapped.z - snapped.z, step),
  };
};

/**
 * Follows the pointer with the corner. A target that would collapse the run is
 * pulled back to the nearest accepted one on the way from the last accepted target.
 */
const dragCorner = (
  ctx: ToolContext,
  g: Gesture<'vertex'>,
  e: ToolPointerEvent
): Gesture<'vertex'> => {
  const plan = ctx.plan.getPlan();
  let target = e.snapped;
  let cmds = vertexDragCommands(plan, g.run, g.index, target);
  if (!cmds) {
    const step = e.altKey ? null : ctx.get(snapStepAtom);
    target = clampVertexTarget(g.run, g.index, g.target, target, step);
    cmds = vertexDragCommands(plan, g.run, g.index, target) ?? [];
  }
  ctx.set(editPreviewAtom, cmds.length > 0 ? cmds : null);
  return { ...g, target };
};

/**
 * Previews the selection moved to the pointer. An opening whose slide is refused
 * keeps the position it had in the last preview (its last valid one).
 */
const moveSelection = (ctx: ToolContext, g: Gesture<'moving'>, e: ToolPointerEvent): void => {
  const plan = ctx.plan.getPlan();
  const d = moveDelta(ctx, g, e);
  const refused = refusedSlides(plan, g.items, d, getLibrary());
  const kept = (ctx.get(editPreviewAtom) ?? []).filter(
    (cmd) => cmd.type === 'opening.patch' && refused.has(cmd.id)
  );
  const cmds = [...translateCommands(plan, g.items, d, getLibrary()), ...kept];
  ctx.set(editPreviewAtom, cmds.length > 0 ? cmds : null);
};

/** Follows the pointer; returns the updated gesture. */
const drag = (ctx: ToolContext, g: SelectGesture, e: ToolPointerEvent): SelectGesture => {
  switch (g.phase) {
    case 'moving': {
      // Along the grabbed point's plane; a ray that misses it leaves the preview as is.
      const on = onPlaneAt(ctx, e, g.grab.y);
      if (on) moveSelection(ctx, g, on);
      return g;
    }
    case 'box':
      return { ...g, currentWorld: e.world, currentScreen: e.screen };
    case 'vertex':
      return dragCorner(ctx, g, e);
    case 'idle':
    case 'pressing':
      return g;
    default: {
      const unknown: never = g;
      return unknown;
    }
  }
};

export const onSelectMove = (e: ToolPointerEvent, ctx: ToolContext): void => {
  const g = ctx.get(selectGestureAtom);
  if (g.phase === 'idle') return updateHover(ctx, e);
  if (g.phase === 'pressing') {
    const moved = Math.hypot(e.screen.x - g.startScreen.x, e.screen.y - g.startScreen.y);
    if (moved <= dragThresholdPx(ctx)) return;
    ctx.set(selectGestureAtom, drag(ctx, startDrag(ctx, g), e));
    return;
  }
  ctx.set(selectGestureAtom, drag(ctx, g, e));
};

/** A press released without dragging. */
const click = (ctx: ToolContext, press: Gesture<'pressing'>): void => {
  const { hit, shift, addedOnDown } = press;
  if (!hit) {
    if (!shift) ctx.set(selectionAtom, []);
    return;
  }
  if (hit.kind === 'vertex') return;
  const item = hitItem(hit);
  if (!shift) ctx.set(selectionAtom, [item]);
  else if (!addedOnDown) ctx.set(selectionAtom, (s) => toggleItem(s, item));
};

const selectInBox = (ctx: ToolContext, g: Gesture<'box'>): void => {
  const mode = boxMode(g.startScreen, g.currentScreen);
  const items = itemsInSelectBox(
    ctx,
    { a: g.startWorld, b: g.currentWorld },
    { a: g.startScreen, b: g.currentScreen },
    mode
  );
  ctx.set(selectionAtom, (s) => (g.additive ? unionItems(s, items) : items));
};

export const onSelectUp = (e: ToolPointerEvent, ctx: ToolContext): void => {
  const g = drag(ctx, ctx.get(selectGestureAtom), e);
  const preview = ctx.get(editPreviewAtom) ?? [];
  switch (g.phase) {
    case 'pressing':
      click(ctx, g);
      break;
    case 'moving':
      commitCommands(ctx, itemsLabel('Move', g.items), preview);
      break;
    case 'box':
      selectInBox(ctx, g);
      break;
    case 'vertex':
      commitCommands(ctx, 'Move corner', preview);
      break;
    case 'idle':
      break;
    default: {
      const unknown: never = g;
      throw new Error(`Unknown select gesture ${JSON.stringify(unknown)}`);
    }
  }
  finish(ctx);
  updateHover(ctx, e);
};
