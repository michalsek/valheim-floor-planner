/**
 * Session state: everything about the editor that is not part of the plan document
 * (viewport, tool, modifiers, the pointer, the cut); the cursor is derived from it in
 * `pointer.ts`. One explicit Jotai store is shared by React (via `<Provider store>`) and
 * by plain-object tools, which call `store.get/set`.
 */
import { atom, createStore } from 'jotai';

import type { SnapStep } from '../model/geometry/snap';
import type { ToolId } from '../tools/toolIds';
import type { Projection3d } from '../viewport/projection3d';
import {
  DEFAULT_VIEWPORT,
  fitViewport,
  panBy,
  screenCentre,
  zoomAt,
  type ScreenPoint,
  type Size,
  type Viewport,
  type WorldRect,
} from '../viewport/viewportMath';

export type SessionStore = ReturnType<typeof createStore>;
/** What non-React code needs from the store. */
export type SessionAccess = Pick<SessionStore, 'get' | 'set'>;

export const sessionStore: SessionStore = createStore();

export type RendererBackend = 'pending' | 'WebGPU' | 'WebGL2';

export interface Modifiers {
  alt: boolean;
  space: boolean;
  /** Shift held: the Build tool places freely. */
  shift: boolean;
  /** Ctrl (or ⌘) held: the Build tool removes. */
  mod: boolean;
}

export const viewportAtom = atom<Viewport>(DEFAULT_VIEWPORT);
export const viewportSizeAtom = atom<Size>({ width: 0, height: 0 });
export const snapStepAtom = atom<SnapStep>(0.5);
const NO_MODIFIERS: Modifiers = { alt: false, space: false, shift: false, mod: false };
export const modifiersAtom = atom<Modifiers>(NO_MODIFIERS);
/** Pointer position relative to the canvas, or null when the pointer is outside it. */
export const pointerScreenAtom = atom<ScreenPoint | null>(null);
export const activeToolIdAtom = atom<ToolId>('select');
export const rendererBackendAtom = atom<RendererBackend>('pending');

/**
 * 'failed' after a save threw (e.g. quota); 'unavailable' when storage is blocked;
 * 'unread' when the stored plan couldn't be read (autosave off, so it isn't overwritten).
 */
export type AutosaveStatus = 'ok' | 'failed' | 'unavailable' | 'unread';
export const autosaveStatusAtom = atom<AutosaveStatus>('ok');

/**
 * The cut height H: what shows is what starts below it (`cut.ts`); null is All (no cut).
 * The Cut bar, PageUp / PageDown and C set it. Session only, never undone.
 */
export const cutHeightAtom = atom<number | null>(null);

/** The last cut set (never All), for C to go back to. */
export const lastCutAtom = atom<number | null>(null);

/** A new, opened or imported plan: shown whole, and C forgets the old plan's cut. */
export const resetCut = (store: SessionAccess): void => {
  store.set(cutHeightAtom, null);
  store.set(lastCutAtom, null);
};

/** The cut's step: 1 m, or 0.5 m (grausten floors are 0.5 m thick). */
export type CutStep = 1 | 0.5;
export const cutStepAtom = atom<CutStep>(1);

/** 3D: pieces above the cut are drawn as frosted boxes (never pickable). */
export const cutGhostAtom = atom<boolean>(false);

/** Colour pieces by structural support instead of material (both views). */
export const supportViewAtom = atom<boolean>(false);

/** The 3D camera as plain data (`OrbitRig` keeps it current); null outside 3D. */
export const projection3dAtom = atom<Projection3d | null>(null);

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

/** Frames `box` (world metres) in the canvas, with a margin; no change for null. */
export const fitViewTo = (store: SessionAccess, box: WorldRect | null): void => {
  if (!box) return;
  store.set(viewportAtom, fitViewport(store.get(viewportSizeAtom), box));
};

export const setModifier = (store: SessionAccess, key: keyof Modifiers, value: boolean): void => {
  if (store.get(modifiersAtom)[key] !== value) {
    store.set(modifiersAtom, (m) => ({ ...m, [key]: value }));
  }
};

export const resetModifiers = (store: SessionAccess): void => {
  for (const key of Object.keys(NO_MODIFIERS) as (keyof Modifiers)[])
    setModifier(store, key, false);
};

/** A cursor the active tool asks for over what it hovers (e.g. `move`); null for its default. */
export const cursorStyleAtom = atom<string | null>(null);

/** Show every station's and ward's ring, not just the selected ones (status strip). */
export const showAllRadiiAtom = atom<boolean>(false);
/**
 * Whether roofs are drawn, in both views (session only). Hidden roofs can't be picked,
 * so 3D clicks reach inside the house; their gable walls still show.
 */
export const roofsVisibleAtom = atom<boolean>(true);
/**
 * Whether an imported site's terrain is drawn, in both views (session only). Support
 * uses the terrain either way.
 */
export const terrainShownAtom = atom<boolean>(true);
/** Whether the underlay image is drawn (session only; the plan keeps it either way). */
export const underlayVisibleAtom = atom<boolean>(true);
/** Whether Save puts the underlay image in the file (as a data URL). */
export const embedUnderlayAtom = atom<boolean>(false);
