/**
 * 3D view session state: which view the canvas shows, the 3D camera to come back to,
 * and fit / reset / dolly requests from keys and buttons. None of it is saved or undone.
 * (Only types come from `session.ts`, which imports this module.)
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

/** Frame the plan, look from the default direction, or move the camera in or out. */
export type OrbitRequestKind = 'fit' | 'reset' | 'dollyIn' | 'dollyOut';

/** The latest camera request; `n` grows with each, so a repeat still fires. */
export const orbitRequestAtom = atom<{ kind: OrbitRequestKind; n: number } | null>(null);

export const requestOrbit = (ctx: SessionAccess, kind: OrbitRequestKind): void => {
  ctx.set(orbitRequestAtom, (r) => ({ kind, n: (r?.n ?? 0) + 1 }));
};

/**
 * Switches views. `ToolHost` then cancels any pointer gesture in progress (drafts stay)
 * and drops the pointer and hover; entering 3D with a 2D-only tool switches to Select.
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

/**
 * Bumped by `ToolHost` on every press it gives a tool in 3D: the orbit controls on the
 * canvas skip that press (they'd capture the pointer otherwise). The press itself is
 * left to propagate, so window listeners (outside-click menus) still see it.
 */
export const toolPressAtom = atom<number>(0);
