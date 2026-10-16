import { useStore } from 'jotai';
import { useEffect, type RefObject } from 'react';

import { panViewport, viewportSizeAtom, zoomViewportAt } from '../store/session';
import { viewModeAtom } from '../store/view3d';

import { localPoint } from './localPoint';
import { classifyWheel, isPinch, normalizeWheelDelta, zoomFactor } from './wheel';

/** Safari's trackpad pinch events (not in the TS DOM lib). */
interface GestureEvent extends UIEvent {
  scale: number;
  clientX: number;
  clientY: number;
}

const preventDefault = (e: Event) => e.preventDefault();
const preventBrowserZoom = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) e.preventDefault();
};

/**
 * Wheel/trackpad pan and zoom, Safari pinch, and size tracking for the canvas
 * container. The wheel listener is native and non-passive (React's `onWheel` is
 * passive), so `preventDefault` stops page scroll and ctrl+wheel browser zoom. A
 * window-level guard also stops browser zoom over the rest of the UI. In 3D the orbit
 * controls take the wheel and pinch instead; only the size tracking stays.
 */
export const useViewportControls = (containerRef: RefObject<HTMLElement | null>): void => {
  const store = useStore();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const in3d = () => store.get(viewModeAtom) === '3d';

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (in3d()) return;
      if (classifyWheel(e) === 'pan') {
        panViewport(store, -e.deltaX, -e.deltaY);
        return;
      }
      const delta = normalizeWheelDelta(e, el.clientHeight);
      zoomViewportAt(store, localPoint(el, e), zoomFactor(delta, isPinch(e)));
    };

    let lastGestureScale = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      lastGestureScale = 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      if (in3d()) return;
      const gesture = e as GestureEvent;
      zoomViewportAt(store, localPoint(el, gesture), gesture.scale / lastGestureScale);
      lastGestureScale = gesture.scale;
    };

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      store.set(viewportSizeAtom, { width, height });
    });

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart);
    el.addEventListener('gesturechange', onGestureChange);
    window.addEventListener('wheel', preventBrowserZoom, { passive: false });
    window.addEventListener('gesturestart', preventDefault);
    window.addEventListener('gesturechange', preventDefault);
    resizeObserver.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      window.removeEventListener('wheel', preventBrowserZoom);
      window.removeEventListener('gesturestart', preventDefault);
      window.removeEventListener('gesturechange', preventDefault);
      resizeObserver.disconnect();
    };
  }, [containerRef, store]);
};
