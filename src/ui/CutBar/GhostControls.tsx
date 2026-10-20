import { useAtom } from 'jotai';

import { ToggleButton } from '../../controls/ToggleButton';
import { ghostOpacityAtom, MAX_GHOST_OPACITY } from '../../store/ghostOpacity';
import { cutGhostAtom } from '../../store/session';

import styles from './CutBar.module.css';

const OPACITY_STEP = 0.05;
const TITLE = 'Ghost opacity: higher is more solid';

/** 3D: Ghost draws what the cut hides, see-through; while it is on, how solid. */
export const GhostControls = () => {
  const [ghost, setGhost] = useAtom(cutGhostAtom);
  const [opacity, setOpacity] = useAtom(ghostOpacityAtom);
  return (
    <>
      <div className={styles.actions}>
        <ToggleButton
          title="Draw what is above the cut as a see-through ghost (it can't be picked)"
          pressed={ghost}
          onChange={setGhost}
        >
          Ghost
        </ToggleButton>
      </div>
      {ghost && (
        <label className={styles.sliderLabel} title={TITLE}>
          Ghost opacity
          <input
            type="range"
            className={styles.slider}
            min={0}
            max={MAX_GHOST_OPACITY}
            step={OPACITY_STEP}
            value={opacity}
            aria-valuetext={`${Math.round(opacity * 100)} %`}
            onChange={(e) => setOpacity(Number(e.currentTarget.value))}
            // Leave the keys to the canvas after a drag (arrows still work from Tab).
            onPointerUp={(e) => e.currentTarget.blur()}
          />
        </label>
      )}
    </>
  );
};
