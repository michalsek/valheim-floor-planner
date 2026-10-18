import { atom } from 'jotai';

import type { BoxMode } from '../../model/geometry/box';
import type { Hit } from '../../model/hitTest';
import type { Selection } from '../../model/selection';
import type { Vec2, WallRun } from '../../model/types';
import type { ScreenPoint } from '../../viewport/viewportMath';

import type { SinkTarget } from './sinkHandle';
import type { Carry } from './snapMove';

/** Where a press grabbed: in 3D, a piece's face may be above the work plane. */
export interface Grab {
  y: number;
  world: Vec2;
  snapped: Vec2;
}

/** The Select tool's pointer gesture (session state, never in history). */
export type SelectGesture =
  | { phase: 'idle' }
  /** Down, not yet moved past the drag threshold. */
  | {
      phase: 'pressing';
      startScreen: ScreenPoint;
      /** On the work plane: where a box select starts. */
      startWorld: Vec2;
      /** The grabbed point, on the horizontal plane at height `y` a move drags along. */
      grab: Grab;
      hit: Hit | null;
      shift: boolean;
      /** The press selected the hit item, so a Shift+click mustn't toggle it off again. */
      addedOnDown: boolean;
    }
  /**
   * Dragging the selection along the grab's plane; previewed in `editPreviewAtom`.
   * `anchor`: the grabbed pole's or beam's snap anchor, which snapped moves put on the grid.
   */
  | { phase: 'moving'; grab: Grab; items: Selection; anchor: Vec2 | null }
  /**
   * Box select: a world rectangle on the work plane, kept in world points so a zoom
   * mid-drag doesn't move it. The screen points decide contain vs touch.
   */
  | {
      phase: 'box';
      startWorld: Vec2;
      currentWorld: Vec2;
      startScreen: ScreenPoint;
      currentScreen: ScreenPoint;
      additive: boolean;
    }
  /** Dragging a corner of `run` (as it was at the start) to `target`, the last accepted one. */
  | { phase: 'vertex'; run: WallRun; index: number; target: Vec2 }
  /** Snap-moving a selection of raw pieces (`snapMove.ts`); previewed in `editPreviewAtom`. */
  | { phase: 'carrying'; items: Selection; carry: Carry }
  /**
   * Dragging the sink handle (`sinkHandle.ts`) from screen height `startY`, at `pxPerMetre`
   * up the screen; `depth` is the first target's depth now.
   */
  | {
      phase: 'sinking';
      targets: readonly SinkTarget[];
      startY: number;
      pxPerMetre: number;
      depth: number;
    };

export const SELECT_IDLE: SelectGesture = { phase: 'idle' };

export const selectGestureAtom = atom<SelectGesture>(SELECT_IDLE);

/** The pointer is over the sink handle. */
export const sinkHotAtom = atom<boolean>(false);

/**
 * Dragged left→right on screen a box selects what it contains; right→left, what it
 * touches (from any camera direction in 3D).
 */
export const boxMode = (start: ScreenPoint, current: ScreenPoint): BoxMode =>
  current.x >= start.x ? 'contain' : 'touch';
