import type { ScreenPoint } from './viewportMath';

/** A pointer/wheel/gesture position relative to `el`'s top-left corner, in CSS px. */
export const localPoint = (el: Element, e: { clientX: number; clientY: number }): ScreenPoint => {
  const rect = el.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
};
