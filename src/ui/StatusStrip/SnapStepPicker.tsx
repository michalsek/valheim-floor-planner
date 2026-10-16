import { useSetAtom } from 'jotai';

import { SegmentedControl } from '../../controls/SegmentedControl';
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
      <SegmentedControl
        options={SNAP_STEPS.map((s) => ({ value: s, label: String(s) }))}
        value={step}
        onChange={(s) => setStep(s)}
      />
      <span>m</span>
    </div>
  );
};
