/**
 * 3D view session state: which view the canvas shows, the 3D camera to come back to,
 * and fit / reset requests from keys and buttons. None of it is saved or undone.
 */
import { atom } from 'jotai';

import type { Vec3 } from '../model/types';

import type { SessionAccess } from './session';

export type ViewMode = '2d' | '3d';

export const viewModeAtom = atom<ViewMode>('2d');

export interface OrbitState {
  position: Vec3;
  target: Vec3;
}

/** The last 3D camera (session only); null fits the plan the next time 3D opens. */
export const orbitStateAtom = atom<OrbitState | null>(null);

export type OrbitRequestKind = 'fit' | 'reset';

/** The latest fit or reset request; `n` grows with each, so a repeat still fires. */
export const orbitRequestAtom = atom<{ kind: OrbitRequestKind; n: number } | null>(null);

export const requestOrbit = (ctx: SessionAccess, kind: OrbitRequestKind): void => {
  ctx.set(orbitRequestAtom, (r) => ({ kind, n: (r?.n ?? 0) + 1 }));
};

/**
 * Switches views. On entering 3D, `ToolHost` cancels any gesture in progress, drops
 * the 2D pointer and hover, and switches to Select.
 */
export const setViewMode = (ctx: SessionAccess, mode: ViewMode): void => {
  if (ctx.get(viewModeAtom) !== mode) ctx.set(viewModeAtom, mode);
};

export const toggleViewMode = (ctx: SessionAccess): void =>
  setViewMode(ctx, ctx.get(viewModeAtom) === '3d' ? '2d' : '3d');

/** A new or opened plan: forget the 3D camera, and fit the plan if 3D is showing. */
export const resetOrbit = (ctx: SessionAccess): void => {
  ctx.set(orbitStateAtom, null);
  requestOrbit(ctx, 'fit');
};
