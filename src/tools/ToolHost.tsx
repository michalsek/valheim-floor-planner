import { useStore } from 'jotai';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { useActiveToolId, useModifiers } from '../store/hooks';
import {
  activeToolIdAtom,
  cursorAtom,
  modifiersAtom,
  panViewport,
  pointerScreenAtom,
  setModifier,
} from '../store/session';
import { localPoint } from '../viewport/localPoint';
import { useViewportControls } from '../viewport/useViewportControls';
import type { ScreenPoint } from '../viewport/viewportMath';

import { MIDDLE_BUTTON, PRIMARY_BUTTON } from './pointerButtons';
import { getTool } from './toolbox';
import styles from './ToolHost.module.css';
import type { ToolPointerEvent } from './types';
import { useToolKeyboard } from './useToolKeyboard';

type HostPointerEvent = ReactPointerEvent<HTMLDivElement>;

/** The pointer this host is tracking: a pan, or a pointer sequence owned by the tool. */
type Gesture =
  { kind: 'pan'; pointerId: number; last: ScreenPoint } | { kind: 'tool'; pointerId: number };

/**
 * The canvas container and the only owner of pointer input (r3f events are unused).
 * Pans on middle drag, Space + drag, or a left drag when the tool asks for it;
 * everything else goes to the active tool as a `ToolPointerEvent`. Either way the
 * pointer is captured until it is released or cancelled.
 */
export const ToolHost = ({ children }: { children: ReactNode }) => {
  const store = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const tool = getTool(useActiveToolId());
  const { space } = useModifiers();

  useViewportControls(containerRef);
  useToolKeyboard();

  const activeTool = () => getTool(store.get(activeToolIdAtom));

  /** Ends the current gesture; a tool sequence that didn't finish is cancelled. */
  const endGesture = useCallback(
    (cancelled: boolean) => {
      const gesture = gestureRef.current;
      gestureRef.current = null;
      if (gesture?.kind === 'pan') setIsPanning(false);
      if (gesture?.kind === 'tool' && cancelled) {
        getTool(store.get(activeToolIdAtom)).onPointerCancel?.(store);
      }
    },
    [store]
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
    store.set(pointerScreenAtom, screen);
    setModifier(store, 'alt', e.altKey);
    return screen;
  };

  const toToolEvent = (e: HostPointerEvent, screen: ScreenPoint): ToolPointerEvent | null => {
    const cursor = store.get(cursorAtom);
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
    if (gestureRef.current) return;
    const screen = trackPointer(e);
    const current = activeTool();
    const startsPan =
      e.button === MIDDLE_BUTTON ||
      (e.button === PRIMARY_BUTTON && (store.get(modifiersAtom).space || current.panOnPrimaryDrag));

    e.currentTarget.setPointerCapture(e.pointerId);
    if (startsPan) {
      gestureRef.current = { kind: 'pan', pointerId: e.pointerId, last: screen };
      setIsPanning(true);
      return;
    }
    gestureRef.current = { kind: 'tool', pointerId: e.pointerId };
    const event = toToolEvent(e, screen);
    if (event) current.onPointerDown?.(event, store);
  };

  const onPointerMove = (e: HostPointerEvent) => {
    const screen = trackPointer(e);
    const gesture = gestureRef.current;
    if (gesture?.kind === 'pan') {
      if (gesture.pointerId !== e.pointerId) return;
      // The release happened somewhere we never heard about.
      if (e.buttons === 0) return endGesture(false);
      panViewport(store, screen.x - gesture.last.x, screen.y - gesture.last.y);
      gesture.last = screen;
      return;
    }
    const event = toToolEvent(e, screen);
    if (event) activeTool().onPointerMove?.(event, store);
  };

  const onPointerUp = (e: HostPointerEvent) => {
    const screen = trackPointer(e);
    const gesture = gestureRef.current;
    if (gesture?.pointerId !== e.pointerId) return;
    endGesture(false);
    if (gesture.kind === 'tool') {
      const event = toToolEvent(e, screen);
      if (event) activeTool().onPointerUp?.(event, store);
    }
  };

  // Fires after a normal pointer-up too, but by then the gesture is already over.
  const onPointerLost = (e: HostPointerEvent) => {
    if (gestureRef.current?.pointerId === e.pointerId) endGesture(true);
  };

  const cursor = isPanning ? 'grabbing' : space ? 'grab' : tool.cursor;

  return (
    <div
      ref={containerRef}
      className={styles.host}
      style={{ cursor }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerLost}
      onLostPointerCapture={onPointerLost}
      onPointerLeave={() => store.set(pointerScreenAtom, null)}
      // Middle-button mousedown would start the browser's autoscroll.
      onMouseDown={(e) => e.button === MIDDLE_BUTTON && e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
};
