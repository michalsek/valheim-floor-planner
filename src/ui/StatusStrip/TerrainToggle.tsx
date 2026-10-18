import { useAtom } from 'jotai';

import { ToggleButton } from '../../controls/ToggleButton';
import { openWorldPanel } from '../../install/loadWorld';
import type { Plan } from '../../model/types';
import { usePlanSelector } from '../../store/planHooks';
import { terrainShownAtom } from '../../store/session';
import { terrainOpacityAtom } from '../../store/terrainOpacity';

import styles from './StatusStrip.module.css';
import { noticeLines } from './terrainNotices';

const importFrameOf = (plan: Plan) => plan.importFrame;

const TITLE = 'Show the ground under the imported build, in both views';

/** How opaque the shown terrain is: lower it to see foundations (3D) or an underlay (2D). */
const OpacitySlider = () => {
  const [opacity, setOpacity] = useAtom(terrainOpacityAtom);
  return (
    <input
      type="range"
      className={styles.opacity}
      aria-label="Terrain opacity"
      title={`Terrain opacity ${Math.round(opacity * 100)} %: lower it to see what is under the ground`}
      min={0}
      max={1}
      step={0.05}
      value={opacity}
      onChange={(e) => setOpacity(Number(e.currentTarget.value))}
      // Leave the keys to the canvas after a drag (arrows still work from Tab).
      onPointerUp={(e) => e.currentTarget.blur()}
    />
  );
};

/**
 * The imported site's ground: a toggle when the plan has it (its title lists the notices,
 * marked "!") with the opacity slider while it is shown, "Terrain…" to add it when the
 * import came without, nothing otherwise.
 */
export const TerrainToggle = () => {
  const frame = usePlanSelector(importFrameOf);
  const [shown, setShown] = useAtom(terrainShownAtom);
  if (!frame) return null;
  if (!frame.terrain) {
    return (
      <button
        type="button"
        className={styles.installButton}
        title={`Add the ground under the imported build: open ${frame.worldName} in the World panel`}
        onClick={openWorldPanel}
      >
        Terrain…
      </button>
    );
  }
  const notices = noticeLines(frame.terrain.notices);
  return (
    <span className={styles.terrain}>
      <ToggleButton
        title={[TITLE, ...notices.map((line) => `! ${line}`)].join('\n\n')}
        pressed={shown}
        onChange={setShown}
      >
        Terrain
        {notices.length > 0 && (
          <span className={styles.notice} aria-label={`${notices.length} notices`}>
            !
          </span>
        )}
      </ToggleButton>
      {shown && <OpacitySlider />}
    </span>
  );
};
