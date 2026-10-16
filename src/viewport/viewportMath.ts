/**
 * World ↔ screen maths for the top-down plan view. One `Viewport` drives both the
 * orthographic camera and the SVG overlay. The camera looks straight down, so the
 * mapping is a plain scale + translate: screen right = +x, screen down = +z, and
 * every length on screen is in CSS px.
 */
import type { Vec2 } from '../model/types';

export interface Viewport {
  /** World point shown at the screen centre (see `screenCentre`). */
  center: Vec2;
  /** CSS px per metre. */
  zoom: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WorldRect {
  min: Vec2;
  max: Vec2;
}

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 400;
export const DEFAULT_VIEWPORT: Viewport = { center: { x: 0, z: 0 }, zoom: 40 };

const clampZoom = (zoom: number): number => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/**
 * Where the viewport centre is drawn: the middle of the screen, rounded down to a
 * whole CSS px so that, at whole-number zooms, grid lines land on device-pixel
 * boundaries whatever the canvas size (`CameraRig` applies the same rounding).
 */
export const screenCentre = (size: Size): ScreenPoint => ({
  x: Math.floor(size.width / 2),
  y: Math.floor(size.height / 2),
});

export const worldToScreen = (v: Viewport, size: Size, p: Vec2): ScreenPoint => {
  const c = screenCentre(size);
  return { x: (p.x - v.center.x) * v.zoom + c.x, y: (p.z - v.center.z) * v.zoom + c.y };
};

export const screenToWorld = (v: Viewport, size: Size, s: ScreenPoint): Vec2 => {
  const c = screenCentre(size);
  return { x: (s.x - c.x) / v.zoom + v.center.x, z: (s.y - c.y) / v.zoom + v.center.z };
};

/** Moves the content by (dxPx, dyPx) screen pixels, as when dragging it. */
export const panBy = (v: Viewport, dxPx: number, dyPx: number): Viewport => ({
  center: { x: v.center.x - dxPx / v.zoom, z: v.center.z - dyPx / v.zoom },
  zoom: v.zoom,
});

/** Multiplies the zoom by `factor` (clamped), keeping the world point under `s` fixed. */
export const zoomAt = (v: Viewport, size: Size, s: ScreenPoint, factor: number): Viewport => {
  const zoom = clampZoom(v.zoom * factor);
  if (zoom === v.zoom) return v;
  const anchor = screenToWorld(v, size, s);
  const c = screenCentre(size);
  return {
    center: { x: anchor.x - (s.x - c.x) / zoom, z: anchor.z - (s.y - c.y) / zoom },
    zoom,
  };
};

export const visibleWorldRect = (v: Viewport, size: Size): WorldRect => ({
  min: screenToWorld(v, size, { x: 0, y: 0 }),
  max: screenToWorld(v, size, { x: size.width, y: size.height }),
});

/** SVG `transform` for content authored in world metres (x → x, z → y). */
export const overlayTransform = (v: Viewport, size: Size): string => {
  const c = screenCentre(size);
  return `translate(${c.x - v.center.x * v.zoom} ${c.y - v.center.z * v.zoom}) scale(${v.zoom})`;
};

/**
 * Offset (CSS px, towards screen right/down) that makes a line `widthCssPx` wide
 * crisp when its nominal position is on a device-pixel boundary: lines an odd number
 * of device pixels wide move half a device pixel onto a pixel centre. The grid shader
 * applies the same rule, so overlay lines stay on top of grid lines.
 */
export const crispLineOffset = (widthCssPx: number, dpr: number): number =>
  Math.round(widthCssPx * dpr) % 2 === 1 ? 0.5 / dpr : 0;
