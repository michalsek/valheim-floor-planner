/**
 * Wheel-event classification for the plan canvas (adapted from yummies
 * `interactionMath`). Trackpads send small pixel deltas (often with deltaX) that
 * should pan; mouse wheels send line/page or large pixel steps that should zoom.
 * Browsers report a trackpad pinch as ctrl+wheel.
 */
export type WheelLike = Pick<WheelEvent, 'ctrlKey' | 'metaKey' | 'deltaMode' | 'deltaX' | 'deltaY'>;

export type WheelAction = 'pan' | 'zoom';

const DELTA_MODE_PIXEL = 0;
const DELTA_MODE_LINE = 1;
const LINE_HEIGHT_PX = 16;
const SMALL_PIXEL_DELTA = 50;
const MAX_ZOOM_DELTA = 100;

export const classifyWheel = (e: WheelLike): WheelAction => {
  if (e.ctrlKey || e.metaKey) return 'zoom';
  if (e.deltaMode !== DELTA_MODE_PIXEL) return 'zoom';
  if (e.deltaX !== 0 || Math.abs(e.deltaY) < SMALL_PIXEL_DELTA) return 'pan';
  return 'zoom';
};

/**
 * True for a trackpad pinch (ctrl + small pixel deltas). Ctrl + a physical mouse
 * wheel sends notch-sized deltas and gets normal wheel sensitivity instead.
 */
export const isPinch = (e: WheelLike): boolean =>
  e.ctrlKey && e.deltaMode === DELTA_MODE_PIXEL && Math.abs(e.deltaY) < SMALL_PIXEL_DELTA;

/** Vertical wheel delta in pixels, whatever the event's delta mode. */
export const normalizeWheelDelta = (e: WheelLike, pageHeight: number): number => {
  if (e.deltaMode === DELTA_MODE_PIXEL) return e.deltaY;
  if (e.deltaMode === DELTA_MODE_LINE) return e.deltaY * LINE_HEIGHT_PX;
  return e.deltaY * Math.max(pageHeight, 1);
};

/** Zoom multiplier for a pixel wheel delta. Pinches (see `isPinch`) are more sensitive than wheel steps. */
export const zoomFactor = (delta: number, isPinch: boolean): number => {
  const clamped = Math.min(MAX_ZOOM_DELTA, Math.max(-MAX_ZOOM_DELTA, delta));
  return Math.exp(-clamped * (isPinch ? 0.01 : 0.002));
};
