/**
 * The Select tool's pointer state machine: press, then either a click (select), a
 * move of the selection, a corner drag or a box select. Moves and corner drags are
 * previewed through `editPreviewAtom` and committed on release as one history entry.
 */
import { wallFamilyById } from '../../catalog';
import { translateCommands, vertexDragCommands } from '../../model/editCommands';
import { boxFromCorners } from '../../model/geometry/box';
import { hitItem, hitTest, itemsInBox, type Hit } from '../../model/hitTest';
import {
  handleWallId,
  isSelected,
  itemsLabel,
  toggleItem,
  unionItems,
} from '../../model/selection';
import type { Vec2 } from '../../model/types';
import { clampVertexTarget } from '../../model/vertexDrag';
import { editPreviewAtom, hoverAtom, selectionAtom } from '../../store/selection';
import { cursorStyleAtom, snapStepAtom, viewportAtom } from '../../store/session';
import { hitTolerance } from '../hitTolerance';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { ToolContext, ToolPointerEvent } from '../types';

import { commitCommands } from './selectActions';
import {
  boxMode,
  DRAG_THRESHOLD_PX,
  HANDLE_PX,
  SELECT_IDLE,
  selectGestureAtom,
  type SelectGesture,
} from './selectState';

type Gesture<P extends SelectGesture['phase']> = Extract<SelectGesture, { phase: P }>;

/** What is under `p`; the single selected wall's corners count as handles. */
const hitAt = (ctx: ToolContext, p: Vec2): Hit | null =>
  hitTest(ctx.plan.getPlan(), p, hitTolerance(ctx), {
    families: wallFamilyById,
    handlesFor: handleWallId(ctx.get(selectionAtom)),
    handleTol: HANDLE_PX / ctx.get(viewportAtom).zoom,
  });

const updateHover = (ctx: ToolContext, p: Vec2): void => {
  const hit = hitAt(ctx, p);
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

export const onSelectDown = (e: ToolPointerEvent, ctx: ToolContext): void => {
  if (e.button !== PRIMARY_BUTTON) return;
  const hit = hitAt(ctx, e.world);
  const selection = ctx.get(selectionAtom);
  // Select on press, so press-and-drag moves an unselected item in one gesture.
  const item = hit && hit.kind !== 'vertex' ? hitItem(hit) : null;
  const addedOnDown = item !== null && !isSelected(selection, item);
  if (item && addedOnDown) ctx.set(selectionAtom, e.shiftKey ? [...selection, item] : [item]);
  ctx.set(selectGestureAtom, {
    phase: 'pressing',
    startScreen: e.screen,
    startWorld: e.world,
    startSnapped: e.snapped,
    hit,
    shift: e.shiftKey,
    addedOnDown,
  });
};

/** The drag a press turns into once it passes the threshold. */
const startDrag = (ctx: ToolContext, press: Gesture<'pressing'>): SelectGesture => {
  ctx.set(hoverAtom, null);
  const { hit, startWorld, startSnapped } = press;
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
    return { phase: 'moving', startWorld, startSnapped, items: ctx.get(selectionAtom) };
  }
  ctx.set(cursorStyleAtom, null);
  return { phase: 'box', startWorld, currentWorld: startWorld, additive: press.shift };
};

/** Snapped moves keep an off-grid object's offset; with Alt (no snapping) the raw delta. */
const moveDelta = (g: Gesture<'moving'>, e: ToolPointerEvent): Vec2 => {
  const start = e.altKey ? g.startWorld : g.startSnapped;
  return { x: e.snapped.x - start.x, z: e.snapped.z - start.z };
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
  let target = e.snapped;
  let cmds = vertexDragCommands(g.run, g.index, target);
  if (!cmds) {
    const step = e.altKey ? null : ctx.get(snapStepAtom);
    target = clampVertexTarget(g.run, g.index, g.target, target, step);
    cmds = vertexDragCommands(g.run, g.index, target) ?? [];
  }
  ctx.set(editPreviewAtom, cmds.length > 0 ? cmds : null);
  return { ...g, target };
};

/** Follows the pointer; returns the updated gesture. */
const drag = (ctx: ToolContext, g: SelectGesture, e: ToolPointerEvent): SelectGesture => {
  switch (g.phase) {
    case 'moving': {
      const cmds = translateCommands(ctx.plan.getPlan(), g.items, moveDelta(g, e));
      ctx.set(editPreviewAtom, cmds.length > 0 ? cmds : null);
      return g;
    }
    case 'box':
      return { ...g, currentWorld: e.world };
    case 'vertex':
      return dragCorner(ctx, g, e);
    default:
      return g;
  }
};

export const onSelectMove = (e: ToolPointerEvent, ctx: ToolContext): void => {
  const g = ctx.get(selectGestureAtom);
  if (g.phase === 'idle') return updateHover(ctx, e.world);
  if (g.phase === 'pressing') {
    const moved = Math.hypot(e.screen.x - g.startScreen.x, e.screen.y - g.startScreen.y);
    if (moved <= DRAG_THRESHOLD_PX) return;
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

const selectInBox = (ctx: ToolContext, g: Gesture<'box'>, end: Vec2): void => {
  const box = boxFromCorners(g.startWorld, end);
  const items = itemsInBox(ctx.plan.getPlan(), box, boxMode(g.startWorld, end));
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
      selectInBox(ctx, g, e.world);
      break;
    case 'vertex':
      commitCommands(ctx, 'Move corner', preview);
      break;
  }
  finish(ctx);
  updateHover(ctx, e.world);
};
