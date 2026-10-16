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
import {
  activeToolIdAtom,
  cursorAtom,
  cursorStyleAtom,
  modifiersAtom,
  panViewport,
  pointerScreenAtom,
  setModifier,
} from '../store/session';
import { viewModeAtom } from '../store/view3d';
import { localPoint } from '../viewport/localPoint';
import { useViewportControls } from '../viewport/useViewportControls';
import type { ScreenPoint } from '../viewport/viewportMath';

import { MIDDLE_BUTTON, PRIMARY_BUTTON } from './pointerButtons';
import { useToolContext } from './toolContext';
import { getTool, setActiveTool } from './toolbox';
import styles from './ToolHost.module.css';
import type { ToolPointerEvent } from './types';
import { useToolKeyboard } from './useToolKeyboard';

type HostPointerEvent = ReactPointerEvent<HTMLDivElement>;
type HostMouseEvent = ReactMouseEvent<HTMLDivElement>;

/** The pointer this host is tracking: a pan, or a pointer sequence owned by the tool. */
type Gesture =
  { kind: 'pan'; pointerId: number; last: ScreenPoint } | { kind: 'tool'; pointerId: number };

/**
 * The canvas container and the only owner of 2D pointer input (r3f events are unused).
 * Pans on middle drag or Space + drag; everything else goes to the active tool as a
 * `ToolPointerEvent`. Either way the pointer is captured until it is released or
 * cancelled. In 3D it stands aside: the orbit controls and 3D picking listen on the
 * canvas itself.
 */
export const ToolHost = ({ children }: { children: ReactNode }) => {
  const ctx = useToolContext();
  const store = useStore();
  const is3d = useViewMode() === '3d';
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const tool = getTool(useActiveToolId());
  const { space } = useModifiers();
  const toolCursor = useAtomValue(cursorStyleAtom);

  useViewportControls(containerRef);
  useToolKeyboard();

  const activeTool = () => getTool(ctx.get(activeToolIdAtom));

  /** Ends the current gesture; a tool sequence that didn't finish is cancelled. */
  const endGesture = useCallback(
    (cancelled: boolean) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (gesture?.kind === 'pan') setIsPanning(false);
      if (gesture?.kind === 'tool' && cancelled) {
        getTool(ctx.get(activeToolIdAtom)).onPointerCancel?.(ctx);
      }
    },
    [ctx]
  );

  // Entering 3D cancels whatever the pointer was doing in 2D; a 2D-only tool hands over
  // to Select.
  useEffect(
    () =>
      store.sub(viewModeAtom, () => {
        if (store.get(viewModeAtom) !== '3d') return;
        endGesture(true);
        ctx.set(pointerScreenAtom, null);
        ctx.set(hoverAtom, null);
        if (!getTool(ctx.get(activeToolIdAtom)).in3d) setActiveTool(ctx, 'select');
      }),
    [store, ctx, endGesture]
  );

  // A gesture must not survive the window losing focus (the release may never arrive).
  useEffect(() => {
    const onBlur = () => endGesture(true);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [endGesture]);

  /** Records the pointer (and Alt, which may change while the window is unfocused). */
  const trackPointer = (e: HostPointerEvent): ScreenPoint => {
    const screen = localPoint(e.currentTarget, e);
    ctx.set(pointerScreenAtom, screen);
    setModifier(ctx, 'alt', e.altKey);
    return screen;
  };

  const toToolEvent = (e: HostMouseEvent, screen: ScreenPoint): ToolPointerEvent | null => {
    const cursor = ctx.get(cursorAtom);
    if (!cursor) return null;
    return {
      screen,
      world: cursor.raw,
      snapped: cursor.snapped,
      button: e.button,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
    };
  };

  const onPointerDown = (e: HostPointerEvent) => {
    if (gestureRef.current || is3d) return;
    const screen = trackPointer(e);
    const current = activeTool();
    const startsPan =
      e.button === MIDDLE_BUTTON || (e.button === PRIMARY_BUTTON && ctx.get(modifiersAtom).space);

    e.currentTarget.setPointerCapture(e.pointerId);
    if (startsPan) {
      gestureRef.current = { kind: 'pan', pointerId: e.pointerId, last: screen };
      setIsPanning(true);
      return;
    }
    gestureRef.current = { kind: 'tool', pointerId: e.pointerId };
    const event = toToolEvent(e, screen);
    if (event) current.onPointerDown?.(event, ctx);
  };

  const onPointerMove = (e: HostPointerEvent) => {
    if (is3d) return;
    const screen = trackPointer(e);
    const gesture = gestureRef.current;
    if (gesture?.kind === 'pan') {
      if (gesture.pointerId !== e.pointerId) return;
      // The release happened somewhere we never heard about.
      if (e.buttons === 0) return endGesture(false);
      panViewport(ctx, screen.x - gesture.last.x, screen.y - gesture.last.y);
      gesture.last = screen;
      return;
    }
    const event = toToolEvent(e, screen);
    if (event) activeTool().onPointerMove?.(event, ctx);
  };

  const onPointerUp = (e: HostPointerEvent) => {
    if (is3d) return;
    const screen = trackPointer(e);
    const gesture = gestureRef.current;
    if (gesture?.pointerId !== e.pointerId) return;
    endGesture(false);
    if (gesture.kind === 'tool') {
      const event = toToolEvent(e, screen);
      // Without a world point the release can't be handled; cancel rather than leave a
      // tool mid-gesture.
      if (event) activeTool().onPointerUp?.(event, ctx);
      else activeTool().onPointerCancel?.(ctx);
    }
  };

  // Fires after a normal pointer-up too, but by then the gesture is already over.
  const onPointerLost = (e: HostPointerEvent) => {
    if (gestureRef.current?.pointerId === e.pointerId) endGesture(true);
  };

  const onDoubleClick = (e: HostMouseEvent) => {
    if (is3d || e.button !== PRIMARY_BUTTON || ctx.get(modifiersAtom).space) return;
    const event = toToolEvent(e, localPoint(e.currentTarget, e));
    if (event) activeTool().onDoubleClick?.(event, ctx);
  };

  const cursor = isPanning ? 'grabbing' : space ? 'grab' : (toolCursor ?? tool.cursor);

  return (
    <div
      ref={containerRef}
      className={styles.host}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onPointerCancel={onPointerLost}
      onLostPointerCapture={onPointerLost}
      onPointerLeave={() => {
        if (is3d) return;
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
