import type { Atom } from 'jotai';
import type { ComponentType } from 'react';

import type { Vec2 } from '../model/types';
import type { PlanStore } from '../store/planStore';
import type { SessionAccess } from '../store/session';
import type { ScreenPoint } from '../viewport/viewportMath';

import type { ToolId } from './toolIds';

export type { ToolId } from './toolIds';

/**
 * A pointer event already converted to plan coordinates by `ToolHost`: the points are
 * those of the surface under the pointer (`pointer.ts`) in both views, so tools work the
 * same in each; `picking.ts` is the only seam that knows which view is showing.
 */
export interface ToolPointerEvent {
  screen: ScreenPoint;
  world: Vec2;
  /** Snapped to the current step, or equal to `world` while Alt is held. */
  snapped: Vec2;
  /** The height of the surface under the pointer (`pointer.ts`). */
  y: number;
  button: number;
  altKey: boolean;
  shiftKey: boolean;
}

/** A pointer event with no world point: only where it is on screen, and its keys. */
export type OffPlanePointerEvent = Pick<
  ToolPointerEvent,
  'screen' | 'button' | 'altKey' | 'shiftKey'
>;

/**
 * What a tool may touch: the session store's `get` and `set`, and the plan store.
 * (Jotai's store methods close over the store, so they work detached.)
 */
export interface ToolContext extends SessionAccess {
  plan: PlanStore;
}

/**
 * A tool is a plain object; `ToolHost` routes pointer and key events to the active
 * one. Tools keep their transient state in atoms so their previews can render it.
 */
export interface Tool {
  id: ToolId;
  label: string;
  /** Single key that activates the tool (no modifiers, Shift included). */
  shortcut: string;
  /** 20 × 20 icon for the ToolRail (draws with `currentColor`). */
  icon: ComponentType;
  /** CSS cursor shown over the canvas while the tool is active (see `cursorStyleAtom`). */
  cursor: string;
  /** False for a 2D-only tool: activating it goes back to 2D (default true). */
  in3d?: boolean;
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  /** The pointer is captured from here until pointer-up or cancel. */
  onPointerDown?(e: ToolPointerEvent, ctx: ToolContext): void;
  onPointerMove?(e: ToolPointerEvent, ctx: ToolContext): void;
  onPointerUp?(e: ToolPointerEvent, ctx: ToolContext): void;
  /** The pointer sequence ended without a pointer-up (cancel or lost capture). */
  onPointerCancel?(ctx: ToolContext): void;
  /** The pointer left the canvas: drop hover state (a captured gesture goes on). */
  onPointerLeave?(ctx: ToolContext): void;
  /**
   * A press with nothing under it to work with (3D: empty sky, no piece and no ground
   * within reach). No other pointer event of that sequence reaches the tool.
   */
  onPointerMiss?(e: OffPlanePointerEvent, ctx: ToolContext): void;
  /**
   * During the tool's own pointer sequence, a move or the release where the pointer has
   * no world point (3D: over the sky, or beyond reach). Without it, such a move only
   * drops the hover and such a release cancels the sequence.
   */
  onPointerOffPlane?(e: OffPlanePointerEvent, phase: 'move' | 'up', ctx: ToolContext): void;
  /** A double-click; its two pointer-downs have already reached `onPointerDown`. */
  onDoubleClick?(e: ToolPointerEvent, ctx: ToolContext): void;
  /** Receives every key first (modified ones too); returns true when handled. */
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): boolean;
  /**
   * A wheel step over the canvas, before the view's zoom or orbit hears it; returns true
   * to consume it. Ctrl/⌘ + wheel and pinches (zoom) never reach it.
   */
  onWheel?(e: WheelEvent, ctx: ToolContext): boolean;
  /** While true, the 3D snap cross and drop line are hidden (the tool's ghost is the cursor). */
  hidesCursor?: Atom<boolean>;
  /** Overlay content in screen CSS px. */
  Preview?: ComponentType;
  /** Overlay content in world metres (strokes need `vector-effect="non-scaling-stroke"`). */
  WorldPreview?: ComponentType;
  /** 3D scene content (r3f) at absolute heights: ghost pieces, drafted lines. */
  Preview3d?: ComponentType;
  /** 3D overlay content in screen CSS px, placed with `useProject3d`: labels, handles. */
  Overlay3d?: ComponentType;
  /** Tool settings, shown in a bar over the top of the canvas. */
  Options?: ComponentType;
}
