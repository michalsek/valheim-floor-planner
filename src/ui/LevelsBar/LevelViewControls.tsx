import { useAtom } from 'jotai';

import { MAX_PLATE_FROST, plateFrostAtom } from '../../store/plateFrost';

import styles from './LevelsBar.module.css';

/** 3D: how frosted the level plate is. */
export const LevelViewControls = () => {
  const [frost, setFrost] = useAtom(plateFrostAtom);
  return (
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
  );
};
