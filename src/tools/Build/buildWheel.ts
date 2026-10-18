/**
 * Wheel notches as the Build ghost's turn steps (M17 §2.3, §9.1): one notch (~100 px of
 * `deltaY`, or one line or page event) is one 22.5° step, wheel up clockwise. Trackpads
 * send many small deltas, so travel short of a notch is carried to the next event.
 */

/** Pixels of wheel travel in one notch. */
const NOTCH_PX = 100;
const DOM_DELTA_PIXEL = 0;

type WheelLike = Pick<WheelEvent, 'deltaMode' | 'deltaY'>;

/** Whole steps in `rest` plus this event (positive: clockwise), and the travel left over. */
export const wheelSteps = (rest: number, e: WheelLike): { steps: number; rest: number } => {
  const notches = e.deltaMode === DOM_DELTA_PIXEL ? e.deltaY / NOTCH_PX : Math.sign(e.deltaY);
  const total = rest - notches;
  // A hair of slack, so ten 0.1-notch deltas make a step despite float sums.
  const steps = Math.trunc(total + Math.sign(total) * 1e-9);
  return { steps, rest: total - steps };
};
