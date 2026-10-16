import type { ComponentType } from 'react';

import type { Vec2 } from '../model/types';
import type { PlanStore } from '../store/planStore';
import type { SessionAccess } from '../store/session';
import type { ScreenPoint } from '../viewport/viewportMath';

import type { ToolId } from './toolIds';

export type { ToolId } from './toolIds';

/**
 * A pointer event already converted to plan coordinates by `ToolHost`. In 3D the
 * points are where the pointer's ray meets the work plane, so tools work the same in
 * both views; `picking.ts` is the only seam that knows which view is showing.
 */
export interface ToolPointerEvent {
  screen: ScreenPoint;
  world: Vec2;
  /** Snapped to the current step, or equal to `world` while Alt is held. */
  snapped: Vec2;
  button: number;
  altKey: boolean;
  shiftKey: boolean;
}

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
   * A press with nothing under it to work with (3D: empty sky, no piece and no work
   * plane). No other pointer event of that sequence reaches the tool.
   */
  onPointerMiss?(e: Pick<ToolPointerEvent, 'button' | 'shiftKey'>, ctx: ToolContext): void;
  /** A double-click; its two pointer-downs have already reached `onPointerDown`. */
  onDoubleClick?(e: ToolPointerEvent, ctx: ToolContext): void;
  /** Receives every key first (modified ones too); returns true when handled. */
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): boolean;
  /** Overlay content in screen CSS px. */
  Preview?: ComponentType;
  /** Overlay content in world metres (strokes need `vector-effect="non-scaling-stroke"`). */
  WorldPreview?: ComponentType;
  /** 3D scene content (r3f): ghost pieces, lines on the work plane. */
  Preview3d?: ComponentType;
  /** 3D overlay content in screen CSS px, placed with `useProject3d`: labels, handles. */
  Overlay3d?: ComponentType;
  /** Tool settings, shown in a bar over the top of the canvas. */
  Options?: ComponentType;
}
