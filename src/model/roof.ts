/**
 * Gable roof fit for a rectangular room (the room badge). Every roof piece covers 2 m
 * of run and the ridge row adds 1 m each side, so any whole-metre half-run (eave to
 * ridge) tiles: what has to be whole is the number of 2 m pieces across the eaves,
 * so the eave span (`span + 2 · eave`) must be even.
 */
import { EPS } from './geometry/polyline';

export interface RoofSpan {
  /** The shorter side, in metres: the roof spans it. */
  span: number;
  /** The roof spans it with whole pieces. */
  wholePiece: boolean;
  /** Ridge height above the wall top for each pitch, in metres. */
  rise: { p26: number; p45: number; p67: number };
}

export const roofSpan = (w: number, d: number, eave = 0): RoofSpan => {
  const span = Math.min(w, d);
  const halves = (span + 2 * eave) / 2;
  return {
    span,
    wholePiece: span > EPS && Math.abs(halves - Math.round(halves)) < EPS,
    rise: { p26: span / 4, p45: span / 2, p67: span },
  };
};
