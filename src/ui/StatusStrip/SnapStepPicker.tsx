import { useSetAtom } from 'jotai';

import { SNAP_STEPS } from '../../model/geometry/snap';
import { useModifiers, useSnapStep } from '../../store/hooks';
import { snapStepAtom } from '../../store/session';

import styles from './StatusStrip.module.css';

/** Segmented 0.5 / 1 / 2 m snap control (G cycles it). */
export const SnapStepPicker = () => {
  const step = useSnapStep();
  const setStep = useSetAtom(snapStepAtom);
  const { alt } = useModifiers();

  if (alt) return <span className={styles.snapOff}>Snap off (Alt)</span>;

  return (
    <div className={styles.picker} title="Snap step (G)">
      <span>Snap</span>
      <div className={styles.segments}>
        {SNAP_STEPS.map((s) => (
          <button
            key={s}
            type="button"
            className={s === step ? `${styles.segment} ${styles.segmentActive}` : styles.segment}
            aria-pressed={s === step}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setStep(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <span>m</span>
    </div>
  );
};
