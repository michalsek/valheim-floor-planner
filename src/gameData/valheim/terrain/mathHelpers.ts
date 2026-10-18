/**
 * The small Mathf / DUtils helpers the world generator uses, with float32 rounding exactly
 * where `worldGen.py` rounds (`lerp`, `lerp_step`, `smooth_step`, `length`, …).
 */
import { f } from './unityNatives';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Lerp that returns an end exactly when `t` is outside (0, 1). */
export const lerp = (a: number, b: number, t: number): number =>
  t <= 0 ? a : t >= 1 ? b : f(a * (1 - t) + b * t);

export const lerpStep = (a: number, b: number, v: number): number => f(clamp01((v - a) / (b - a)));

export const smoothStep = (a: number, b: number, v: number): number => {
  const t = lerpStep(a, b, v);
  return f(t * t * (3 - 2 * t));
};

/** `Mathf.SmoothStep(0, 1, t)` on a clamped double. */
export const smoothStepMathf = (v: number): number => {
  const t = clamp01(v);
  return f(-2 * t ** 3 + 3 * (t * t));
};

export const length = (x: number, z: number): number => f(Math.sqrt(x * x + z * z));

/** `WorldAngle`: the ±1 wobble of the biome rings, `sin(20·atan2(x, z))`. */
export const worldAngle = (x: number, z: number): number =>
  f(Math.sin(f(f(Math.atan2(x, z)) * 20)));
