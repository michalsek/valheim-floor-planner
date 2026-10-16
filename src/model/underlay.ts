/** Reference-image underlay geometry: where it lies and two-point calibration. */
import type { WorldBox } from './geometry/box';
import type { Underlay, Vec2 } from './types';

export const MIN_METRES_PER_PIXEL = 1e-4;
export const MAX_METRES_PER_PIXEL = 10;
/** Longest image side a plan accepts. */
export const MAX_UNDERLAY_PX = 16_384;

export const clampMetresPerPixel = (m: number): number =>
  Math.min(MAX_METRES_PER_PIXEL, Math.max(MIN_METRES_PER_PIXEL, m));

const isPixelCount = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= MAX_UNDERLAY_PX;

/**
 * Why `u` can't be stored, or null when it can. Commands and file parsing share it, so
 * whatever a command accepts also loads.
 */
export const underlayProblem = (u: Underlay): string | null => {
  if (u.imageId.length === 0) return 'an underlay needs an image id';
  if (!isPixelCount(u.pixelSize.w) || !isPixelCount(u.pixelSize.h)) {
    return `image sides must be whole numbers from 1 to ${MAX_UNDERLAY_PX} px`;
  }
  if (!Number.isFinite(u.origin.x) || !Number.isFinite(u.origin.z)) {
    return 'an underlay needs a finite origin';
  }
  const m = u.metresPerPixel;
  if (!(m >= MIN_METRES_PER_PIXEL && m <= MAX_METRES_PER_PIXEL)) {
    return `the scale must be ${MIN_METRES_PER_PIXEL} to ${MAX_METRES_PER_PIXEL} m per pixel`;
  }
  if (!(u.opacity >= 0 && u.opacity <= 1)) return 'opacity must be from 0 to 1';
  return null;
};

export const underlayRect = (u: Underlay): WorldBox => ({
  min: u.origin,
  max: {
    x: u.origin.x + u.pixelSize.w * u.metresPerPixel,
    z: u.origin.z + u.pixelSize.h * u.metresPerPixel,
  },
});

/**
 * Scales the underlay about `a` so the distance from `a` to `b` (world points on the
 * image as it lies now) becomes `metres`. Null when the points coincide, the distance
 * isn't a positive number, or the scale would leave the allowed range.
 */
export const calibrate = (
  u: Underlay,
  a: Vec2,
  b: Vec2,
  metres: number
): Pick<Underlay, 'origin' | 'metresPerPixel'> | null => {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  if (length < 1e-6 || !Number.isFinite(metres) || metres <= 0) return null;
  const s = metres / length;
  const metresPerPixel = u.metresPerPixel * s;
  if (metresPerPixel < MIN_METRES_PER_PIXEL || metresPerPixel > MAX_METRES_PER_PIXEL) return null;
  return {
    origin: { x: a.x + (u.origin.x - a.x) * s, z: a.z + (u.origin.z - a.z) * s },
    metresPerPixel,
  };
};
