import { useAtomValue } from 'jotai';

import { formatHeight } from '../../format';
import { cutRange } from '../../model/cut';
import { getPieceBoxes, usePlan } from '../../store/planHooks';
import { cutHeightAtom, cutStepAtom } from '../../store/session';
import { setCut } from '../../tools/cutActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './CutBar.module.css';

/** Past `max` by less than this is still `max` (float noise in the range's steps). */
const PAST_MAX = 1e-6;

/**
 * The cut as a slider, live, on the step's grid (`cutRange`): from the first value that
 * shows something to the one PageDown from All gives, and one notch more, which is All.
 * Hidden without pieces.
 */
export const CutSlider = () => {
  const ctx = useToolContext();
  const h = useAtomValue(cutHeightAtom);
  const step = useAtomValue(cutStepAtom);
  const range = cutRange(getPieceBoxes(usePlan()), step);
  if (!range) return null;
  const all = range.max + step;
  return (
    <input
      type="range"
      className={styles.slider}
      aria-label="Cut height"
      title="Sweep the cut (the top notch is All)"
      min={range.min}
      max={all}
      step={step}
      value={h ?? all}
      aria-valuetext={h === null ? 'All' : formatHeight(h, 3)}
      onChange={(e) => {
        const v = Number(e.currentTarget.value);
        setCut(ctx, v > range.max + PAST_MAX ? null : v);
      }}
      // Leave the keys to the canvas after a drag (arrows still work from Tab).
      onPointerUp={(e) => e.currentTarget.blur()}
    />
  );
};
