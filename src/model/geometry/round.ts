/** Rounding shared by stored positions and turns. Pure. */

/**
 * `n` rounded to 1e-6 (metres or degrees), without −0: stored pivots and turns, so
 * repeated edits don't drift and equal values compare equal.
 */
export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;
