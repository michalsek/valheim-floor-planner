/**
 * Session state: everything about the editor that is not part of the plan document
 * (viewport, tool, modifiers, cursor). One explicit Jotai store is shared by React
 * (via `<Provider store>`) and by plain-object tools, which call `store.get/set`.
 */
import { atom, createStore } from 'jotai';

import { DEFAULT_WALL_FAMILY_ID } from '../catalog';
import { snapToGrid, type SnapStep } from '../model/geometry/snap';
import type { Vec2, WallSide } from '../model/types';
import type { ToolId } from '../tools/toolIds';
import {
  DEFAULT_VIEWPORT,
  panBy,
  screenCentre,
  screenToWorld,
  zoomAt,
  type ScreenPoint,
  type Size,
  type Viewport,
} from '../viewport/viewportMath';

export type SessionStore = ReturnType<typeof createStore>;
/** What non-React code needs from the store. */
export type SessionAccess = Pick<SessionStore, 'get' | 'set'>;

export const sessionStore: SessionStore = createStore();

export type RendererBackend = 'pending' | 'WebGPU' | 'WebGL2';

export interface Modifiers {
  alt: boolean;
  space: boolean;
}

export interface Cursor {
  raw: Vec2;
  /** The snapped point, or the raw point while snapping is off (Alt held). */
  snapped: Vec2;
  snapping: boolean;
}

export const viewportAtom = atom<Viewport>(DEFAULT_VIEWPORT);
export const viewportSizeAtom = atom<Size>({ width: 0, height: 0 });
export const snapStepAtom = atom<SnapStep>(0.5);
export const modifiersAtom = atom<Modifiers>({ alt: false, space: false });
/** Pointer position relative to the canvas, or null when the pointer is outside it. */
export const pointerScreenAtom = atom<ScreenPoint | null>(null);
export const activeToolIdAtom = atom<ToolId>('select');
export const rendererBackendAtom = atom<RendererBackend>('pending');

/** 'failed' after a save threw (e.g. quota); 'unavailable' when storage is blocked. */
export type AutosaveStatus = 'ok' | 'failed' | 'unavailable';
export const autosaveStatusAtom = atom<AutosaveStatus>('ok');

// Wall tool settings (session state: they never enter undo history).
export const wallFamilyIdAtom = atom<string>(DEFAULT_WALL_FAMILY_ID);
/** 'right' is inside for a loop drawn clockwise on screen. */
export const wallSideAtom = atom<WallSide>('right');
export const wallHeightAtom = atom<number>(2);

/**
 * The world point under the pointer. Derived (not stored), so it stays correct after
 * a pan, zoom or snap change without any pointer movement.
 */
export const cursorAtom = atom<Cursor | null>((get) => {
  const screen = get(pointerScreenAtom);
  if (!screen) return null;
  const raw = screenToWorld(get(viewportAtom), get(viewportSizeAtom), screen);
  const snapping = !get(modifiersAtom).alt;
  return { raw, snapped: snapping ? snapToGrid(raw, get(snapStepAtom)) : raw, snapping };
});

// Actions shared by the pointer, wheel and keyboard handlers.

export const panViewport = (store: SessionAccess, dxPx: number, dyPx: number): void => {
  store.set(viewportAtom, (v) => panBy(v, dxPx, dyPx));
};

/** Zooms about a screen point; without one, about the screen centre. */
export const zoomViewportAt = (
  store: SessionAccess,
  point: ScreenPoint | null,
  factor: number
): void => {
  const size = store.get(viewportSizeAtom);
  store.set(viewportAtom, (v) => zoomAt(v, size, point ?? screenCentre(size), factor));
};

export const setModifier = (store: SessionAccess, key: keyof Modifiers, value: boolean): void => {
  if (store.get(modifiersAtom)[key] !== value) {
    store.set(modifiersAtom, (m) => ({ ...m, [key]: value }));
  }
};

export const resetModifiers = (store: SessionAccess): void => {
  setModifier(store, 'alt', false);
  setModifier(store, 'space', false);
};
