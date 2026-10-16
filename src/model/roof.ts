/**
 * Gable roof fit for a rectangular room (research/README.md §3): every roof piece
 * covers 2 m of run, so a symmetric ridge lands on the grid only when the half-span
 * is a multiple of 2 m.
 */
import { EPS } from './geometry/polyline';

export interface RoofSpan {
  /** The shorter side, in metres: the roof spans it. */
  span: number;
  /** The ridge lands on the grid with whole roof pieces. */
  wholePiece: boolean;
  /** Ridge height above the wall top for each pitch, in metres. */
  rise: { p26: number; p45: number; p67: number };
}

export const roofSpan = (w: number, d: number): RoofSpan => {
  const span = Math.min(w, d);
  const pieces = span / 4;
  return {
    span,
    wholePiece: span > EPS && Math.abs(pieces - Math.round(pieces)) < EPS,
    rise: { p26: span / 4, p45: span / 2, p67: span },
  };
};
