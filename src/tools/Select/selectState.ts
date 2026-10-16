import { atom } from 'jotai';

import type { BoxMode } from '../../model/geometry/box';
import type { Hit } from '../../model/hitTest';
import type { Selection } from '../../model/selection';
import type { Vec2, WallRun } from '../../model/types';
import type { ScreenPoint } from '../../viewport/viewportMath';

/** A press that moves further than this (screen px) is a drag, not a click. */
export const DRAG_THRESHOLD_PX = 3;
/** Radius (screen px) of the vertex handles on a selected wall. */
export const HANDLE_PX = 6;

/** The Select tool's pointer gesture (session state, never in history). */
export type SelectGesture =
  | { phase: 'idle' }
  /** Down, not yet moved past the drag threshold. */
  | {
      phase: 'pressing';
      startScreen: ScreenPoint;
      startWorld: Vec2;
      startSnapped: Vec2;
      hit: Hit | null;
      shift: boolean;
      /** The press selected the hit item, so a Shift+click mustn't toggle it off again. */
      addedOnDown: boolean;
    }
  /** Dragging the selection; the move is previewed in `editPreviewAtom`. */
  | { phase: 'moving'; startWorld: Vec2; startSnapped: Vec2; items: Selection }
  /** Box select, kept in world points so a zoom mid-drag doesn't move the box. */
  | { phase: 'box'; startWorld: Vec2; currentWorld: Vec2; additive: boolean }
  /** Dragging a corner of `run` (as it was at the start) to `target`, the last accepted one. */
  | { phase: 'vertex'; run: WallRun; index: number; target: Vec2 };

export const SELECT_IDLE: SelectGesture = { phase: 'idle' };

export const selectGestureAtom = atom<SelectGesture>(SELECT_IDLE);

/**
 * Dragged left→right a box selects what it contains; right→left, what it touches.
 * (Screen x and world x run the same way, so world points decide it.)
 */
export const boxMode = (start: Vec2, current: Vec2): BoxMode =>
  current.x >= start.x ? 'contain' : 'touch';
