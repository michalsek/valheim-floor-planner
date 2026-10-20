/**
 * Elevations: the absolute height props and dimensions stand at (raw pieces hold their
 * pivot's height in `position.y`, `rawPieces.ts`). Commands and file parsing share the
 * range, so whatever a command accepts also loads.
 */

/** Below the ground for basements and buried foundations; up for towers. */
export const MIN_ELEVATION = -16;
export const MAX_ELEVATION = 128;

/** Elevations closer than this are the same height. */
const SAME_HEIGHT = 1e-3;

/** Why `elevation` can't be stored, or null when it can. */
export const elevationProblem = (elevation: number): string | null =>
  Number.isFinite(elevation) && elevation >= MIN_ELEVATION && elevation <= MAX_ELEVATION
    ? null
    : `the elevation must be a number from ${MIN_ELEVATION} to ${MAX_ELEVATION} m`;

export const sameHeight = (a: number, b: number): boolean => Math.abs(a - b) < SAME_HEIGHT;

/** An elevation rounded to the millimetre (stops, cut heights, typed values). */
export const roundElevation = (e: number): number => Math.round(e * 1000) / 1000 + 0;

export const clampElevation = (e: number): number =>
  Math.min(MAX_ELEVATION, Math.max(MIN_ELEVATION, e));
