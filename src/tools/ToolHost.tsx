import { useAtomValue, useStore } from 'jotai';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { useActiveToolId, useModifiers, useViewMode } from '../store/hooks';
import { hoverAtom } from '../store/selection';
import { snapToGrid } from '../model/geometry/snap';
import {
  activeToolIdAtom,
  cursorAtom,
  cursorStyleAtom,
  effectiveSnapStepAtom,
  levelPickAtom,
  modifiersAtom,
  panViewport,
  pointerScreenAtom,
  projection3dAtom,
  setModifier,
  type Cursor,
} from '../store/session';
import { toolPressAtom, viewModeAtom } from '../store/view3d';
import { localPoint } from '../viewport/localPoint';
import { useViewportControls } from '../viewport/useViewportControls';
import type { ScreenPoint } from '../viewport/viewportMath';

import { pickLevel } from './levelActions';
import { dragThresholdPx, surfacePlanPoint } from './picking';
import { MIDDLE_BUTTON, PRIMARY_BUTTON } from './pointerButtons';
import { useToolContext } from './toolContext';
import { getTool, setActiveTool, worksIn3d } from './toolbox';
import styles from './ToolHost.module.css';
import type { ToolContext, ToolPointerEvent } from './types';
import { useToolKeyboard } from './useToolKeyboard';

type HostPointerEvent = ReactPointerEvent<HTMLDivElement>;

/** A cursor on the piece under a canvas point, for 3D rays that miss the work plane. */
const surfaceCursor = (ctx: ToolContext, screen: ScreenPoint, alt: boolean): Cursor | null => {
  const raw = surfacePlanPoint(ctx, screen);
  if (!raw) return null;
  const snapped = alt ? raw : snapToGrid(raw, ctx.get(effectiveSnapStepAtom));
  return { raw, snapped, snapping: !alt };
};
type HostMouseEvent = ReactMouseEvent<HTMLDivElement>;

/**
 * The pointer this host is tracking: a 2D pan, a pointer sequence owned by the tool, or
 * (in 3D) a press the orbit controls own, during which the tool hears nothing.
 */
type Gesture =
  | { kind: 'pan'; pointerId: number; last: ScreenPoint }
  /** `press`: where it went down, when it had a world point there. */
  | { kind: 'tool'; pointerId: number; press: ScreenPoint | null }
  | { kind: 'camera'; pointerId: number };

/**
 * The canvas container and the only owner of pointer input for tools (r3f events are
 * unused). A left press goes to the active tool as a `ToolPointerEvent`, in both views,
 * and is captured until it is released or cancelled. Middle drag or Space + drag pans:
 * in 2D here; in 3D the orbit controls on the canvas do it (and orbit on right drag),
 * so those presses are let through to them.
 *
 * Presses are taken in the capture phase: React's root listener runs before the
 * canvas's own, so a tool press can tell the orbit controls to skip it (they capture
 * every press they see, even on buttons mapped to nothing) before they hear it. The
 * press is never stopped, so window listeners (outside-click menus) still see it.
 *
 * In 3D, where the pointer's ray misses the work plane, a piece under it (a wall seen
 * against the sky) gives the world point instead; with neither, moves drop the tool's
 * hover, a press is a miss and a release cancels.
 */
export const ToolHost = ({ children }: { children: ReactNode }) => {
  const ctx = useToolContext();
  const store = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  /** The last event the tool got: a release without a world point (3D) reuses it. */
  const lastToolEventRef = useRef<ToolPointerEvent | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const tool = getTool(useActiveToolId());
  const is3d = useViewMode() === '3d';
  const { space } = useModifiers();
  const toolCursor = useAtomValue(cursorStyleAtom);
  const levelPick = useAtomValue(levelPickAtom);

  useViewportControls(containerRef);
  useToolKeyboard();

  const activeTool = useCallback(() => getTool(ctx.get(activeToolIdAtom)), [ctx]);

  /** Ends the current gesture; a tool sequence that didn't finish is cancelled. */
  const endGesture = useCallback(
    (cancelled: boolean) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (gesture?.kind === 'pan') setIsPanning(false);
      if (gesture?.kind === 'tool' && cancelled) activeTool().onPointerCancel?.(ctx);
    },
    [ctx, activeTool]
  );

  /** The pointer's current world point as a tool event (null without one). */
  const toolEvent = useCallback(
    (
      screen: ScreenPoint,
      e: { button: number; altKey: boolean; shiftKey: boolean }
    ): ToolPointerEvent | null => {
      const cursor = ctx.get(cursorAtom) ?? surfaceCursor(ctx, screen, e.altKey);
      if (!cursor) return null;
      const event = {
        screen,
        world: cursor.raw,
        snapped: cursor.snapped,
        button: e.button,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
      };
      lastToolEventRef.current = event;
      return event;
    },
    [ctx]
  );

  // Switching views cancels the pointer gesture in progress (drafts stay) and drops the
  // pointer and hover; a 2D-only tool hands over to Select in 3D.
  useEffect(
    () =>
      store.sub(viewModeAtom, () => {
        endGesture(true);
        ctx.set(pointerScreenAtom, null);
        activeTool().onPointerLeave?.(ctx);
        ctx.set(hoverAtom, null);
        if (store.get(viewModeAtom) === '3d' && !worksIn3d(activeTool())) {
          setActiveTool(ctx, 'select');
        }
      }),
    [store, ctx, endGesture, activeTool]
  );

  // In 3D a camera move (damping, zoom, fit, a dolly key) changes what is under a still
  // pointer: the tool hears it as a move, so hover and drags follow. Not while the
  // camera is being dragged.
  useEffect(
    () =>
      store.sub(projection3dAtom, () => {
        const gesture = gestureRef.current;
        const screen = ctx.get(pointerScreenAtom);
        if (gesture?.kind === 'camera' || gesture?.kind === 'pan' || !screen) return;
        const last = lastToolEventRef.current;
        const event = toolEvent(screen, {
          button: last?.button ?? PRIMARY_BUTTON,
          altKey: ctx.get(modifiersAtom).alt,
          shiftKey: last?.shiftKey ?? false,
        });
        if (event) activeTool().onPointerMove?.(event, ctx);
        else activeTool().onPointerLeave?.(ctx);
      }),
    [store, ctx, toolEvent, activeTool]
  );

  // The tool hears the wheel first (capture phase, before the 2D zoom and the orbit
  // controls on the canvas) and may consume it. Zooms (Ctrl/⌘ + wheel, pinches) pass.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || !activeTool().onWheel?.(e, ctx)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => el.removeEventListener('wheel', onWheel, { capture: true });
  }, [ctx, activeTool]);

  // A gesture must not survive the window losing focus (the release may never arrive).
  useEffect(() => {
    const onBlur = () => endGesture(true);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [endGesture]);

  /**
   * Records the pointer (and Alt, Shift and Ctrl / ⌘, which may change while the window
   * is unfocused).
   */
  const trackPointer = (e: HostPointerEvent): ScreenPoint => {
    const screen = localPoint(e.currentTarget, e);
    ctx.set(pointerScreenAtom, screen);
    setModifier(ctx, 'alt', e.altKey);
    setModifier(ctx, 'shift', e.shiftKey);
    setModifier(ctx, 'mod', e.ctrlKey || e.metaKey);
    return screen;
  };

  const onPointerDownCapture = (e: HostPointerEvent) => {
    if (gestureRef.current) return;
    const screen = trackPointer(e);
    const panKey = e.button === PRIMARY_BUTTON && ctx.get(modifiersAtom).space;
    if (is3d && (e.button !== PRIMARY_BUTTON || panKey)) {
      // The orbit controls' press: the tool drops its hover and waits for the release.
      gestureRef.current = { kind: 'camera', pointerId: e.pointerId };
      activeTool().onPointerLeave?.(ctx);
      return;
    }
    if (is3d) ctx.set(toolPressAtom, (n) => n + 1);
    if (levelPick && e.button === PRIMARY_BUTTON && !panKey) {
      // The Levels bar's Pick: this click only picks a level.
      pickLevel(ctx, screen, ctx.get(cursorAtom)?.raw ?? null);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (e.button === MIDDLE_BUTTON || panKey) {
      gestureRef.current = { kind: 'pan', pointerId: e.pointerId, last: screen };
      setIsPanning(true);
      return;
    }
    lastToolEventRef.current = null;
    const event = toolEvent(screen, e);
    gestureRef.current = { kind: 'tool', pointerId: e.pointerId, press: event && screen };
    if (event) activeTool().onPointerDown?.(event, ctx);
    else activeTool().onPointerMiss?.(e, ctx);
  };

  const onPointerMove = (e: HostPointerEvent) => {
    const screen = trackPointer(e);
    const gesture = gestureRef.current;
    if (gesture && gesture.kind !== 'tool') {
      if (gesture.pointerId !== e.pointerId) return;
      // The release happened somewhere we never heard about.
      if (e.buttons === 0) return endGesture(false);
      if (gesture.kind === 'pan') {
        panViewport(ctx, screen.x - gesture.last.x, screen.y - gesture.last.y);
        gesture.last = screen;
      }
      return;
    }
    // Without a world point (a 3D ray at the sky) the tool keeps its state, but its
    // hover goes.
    const event = toolEvent(screen, e);
    if (event) activeTool().onPointerMove?.(event, ctx);
    else activeTool().onPointerLeave?.(ctx);
  };

  const onPointerUp = (e: HostPointerEvent) => {
    const screen = trackPointer(e);
    const gesture = gestureRef.current;
    if (gesture?.pointerId !== e.pointerId) return;
    endGesture(false);
    if (gesture.kind !== 'tool') return;
    const event = toolEvent(screen, e) ?? clickAtPress(gesture.press, screen, e.button);
    if (event) activeTool().onPointerUp?.(event, ctx);
    else activeTool().onPointerCancel?.(ctx);
  };

  /**
   * A release without a world point that is still a click (it barely moved from a press
   * that had one) lands where the press did; a drag released at the sky has nothing to
   * land on.
   */
  const clickAtPress = (
    press: ScreenPoint | null,
    screen: ScreenPoint,
    button: number
  ): ToolPointerEvent | null => {
    const last = lastToolEventRef.current;
    if (!press || !last) return null;
    const moved = Math.hypot(screen.x - press.x, screen.y - press.y);
    return moved <= dragThresholdPx(ctx) ? { ...last, screen, button } : null;
  };

  // Fires after a normal pointer-up too, but by then the gesture is already over.
  const onPointerLost = (e: HostPointerEvent) => {
    if (gestureRef.current?.pointerId === e.pointerId) endGesture(true);
  };

  const onDoubleClick = (e: HostMouseEvent) => {
    if (e.button !== PRIMARY_BUTTON || ctx.get(modifiersAtom).space) return;
    const event = toolEvent(localPoint(e.currentTarget, e), e);
    if (event) activeTool().onDoubleClick?.(event, ctx);
  };

  const cursor = isPanning
    ? 'grabbing'
    : space
      ? 'grab'
      : levelPick
        ? 'cell'
        : (toolCursor ?? tool.cursor);

  return (
    <div
      ref={containerRef}
      className={styles.host}
      style={{ cursor }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onPointerCancel={onPointerLost}
      onLostPointerCapture={onPointerLost}
      onPointerLeave={() => {
        ctx.set(pointerScreenAtom, null);
        activeTool().onPointerLeave?.(ctx);
      }}
      // Middle-button mousedown would start the browser's autoscroll.
      onMouseDown={(e) => e.button === MIDDLE_BUTTON && e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
};
