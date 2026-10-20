import { keepFocus } from '../../controls/keepFocus';
import { formatHeight } from '../../format';
import type { StoreyStop } from '../../model/cut';
import { sameHeight } from '../../model/elevation';
import { setCut } from '../../tools/cutActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './CutBar.module.css';

/** To the millimetre, as the cut field shows a stop's height. */
const STOP_DIGITS = 3;

/** The storey stops, top to bottom, with what each reveals: click one to cut there. */
export const StopList = ({ stops, h }: { stops: readonly StoreyStop[]; h: number | null }) => {
  const ctx = useToolContext();
  return (
    <ul className={styles.stops}>
      {stops.toReversed().map(({ height, count }) => {
        const current = h !== null && sameHeight(height, h);
        return (
          <li key={height}>
            <button
              type="button"
              className={current ? `${styles.stop} ${styles.stopCurrent}` : styles.stop}
              aria-current={current}
              title="Cut here: hides this floor and what starts above it (Shift+PageUp / PageDown: the next stop)"
              onMouseDown={keepFocus}
              onClick={() => setCut(ctx, height)}
            >
              <span className={styles.stopHeight}>{formatHeight(height, STOP_DIGITS)}</span>
              <span className={styles.count}>{count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};
