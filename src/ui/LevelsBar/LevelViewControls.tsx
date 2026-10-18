import { useAtom } from 'jotai';

import { SegmentedControl } from '../../controls/SegmentedControl';
import type { LevelViewMode } from '../../model/levels';
import { MAX_PLATE_FROST, plateFrostAtom } from '../../store/plateFrost';
import { levelViewModeAtom } from '../../store/session';

import styles from './LevelsBar.module.css';

const MODES: readonly { value: LevelViewMode; label: string; title: string }[] = [
  { value: 'only', label: 'One', title: 'Only this level (C: next mode)' },
  {
    value: 'cut',
    label: 'Cut',
    title: 'This level and the ones below, cut above it (C: next mode)',
  },
  { value: 'above', label: 'Up', title: 'This level and the ones above it (C: next mode)' },
  { value: 'all', label: 'All', title: 'Every level, the others faded (C: next mode)' },
];

/** 3D: which levels are drawn, and how frosted the level plate is. */
export const LevelViewControls = () => {
  const [mode, setMode] = useAtom(levelViewModeAtom);
  const [frost, setFrost] = useAtom(plateFrostAtom);
  return (
    <>
      <SegmentedControl<LevelViewMode>
        label="Levels drawn"
        options={MODES}
        value={mode}
        onChange={setMode}
        className={styles.modes}
      />
      <input
        type="range"
        className={styles.frost}
        aria-label="Level plate opacity"
        title="How much the level plate frosts what is below it"
        min={0}
        max={MAX_PLATE_FROST}
        step={0.05}
        value={frost}
        onChange={(e) => setFrost(Number(e.currentTarget.value))}
        // Leave the keys to the canvas after a drag (arrows still work from Tab).
        onPointerUp={(e) => e.currentTarget.blur()}
      />
    </>
  );
};
