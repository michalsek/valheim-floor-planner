import type { Vec2 } from '../types';

/** Snap steps in metres: 0.5 m is the base grid, 1 m and 2 m are the main building modules. */
export const SNAP_STEPS = [0.5, 1, 2] as const;
export type SnapStep = (typeof SNAP_STEPS)[number];

/** Rounds a coordinate to the nearest multiple of `step` (and turns -0 into 0). */
const snapValue = (value: number, step: number): number => Math.round(value / step) * step + 0;

export const snapToGrid = (p: Vec2, step: number): Vec2 => ({
  x: snapValue(p.x, step),
  z: snapValue(p.z, step),
});

/** The step after `step` in `SNAP_STEPS`, wrapping around. */
export const nextSnapStep = (step: SnapStep): SnapStep =>
  SNAP_STEPS[(SNAP_STEPS.indexOf(step) + 1) % SNAP_STEPS.length] ?? SNAP_STEPS[0];
