import { useAtom } from 'jotai';

import { catalog, wallFamilies } from '../../catalog';
import { ToggleButton } from '../../controls/ToggleButton';
import { formatNumber, formatZoom } from '../../format';
import type { Plan } from '../../model/types';
import { useCursor, useRendererBackend, useViewport } from '../../store/hooks';
import { usePlanSelector } from '../../store/planHooks';
import { showAllRadiiAtom, underlayVisibleAtom } from '../../store/session';

import { SnapStepPicker } from './SnapStepPicker';
import styles from './StatusStrip.module.css';
import { ThemePicker } from './ThemePicker';

const hasUnderlay = (plan: Plan) => plan.underlay !== null;

/** Show every ring, and the underlay (when there is one). */
const LayerToggles = () => {
  const [showAll, setShowAll] = useAtom(showAllRadiiAtom);
  const [underlayVisible, setUnderlayVisible] = useAtom(underlayVisibleAtom);
  const underlay = usePlanSelector(hasUnderlay);
  return (
    <>
      <ToggleButton
        title="Show every station's build radius and every ward's ring"
        pressed={showAll}
        onChange={setShowAll}
      >
        Radii
      </ToggleButton>
      {underlay && (
        <ToggleButton
          title="Show the reference image"
          pressed={underlayVisible}
          onChange={setUnderlayVisible}
        >
          Underlay
        </ToggleButton>
      )}
    </>
  );
};

export const StatusStrip = () => {
  const cursor = useCursor();
  const { zoom } = useViewport();
  const backend = useRendererBackend();

  return (
    <footer className={styles.strip}>
      <span className={styles.coords}>
        {cursor
          ? `x ${formatNumber(cursor.snapped.x)}  z ${formatNumber(cursor.snapped.z)} m`
          : '—'}
      </span>
      <span>{formatZoom(zoom)}</span>
      <SnapStepPicker />
      <LayerToggles />
      <span className={styles.spacer} />
      <ThemePicker />
      <span className={styles.debug}>
        {catalog.pieces.size} pieces · {wallFamilies.length} wall families
      </span>
      <span className={styles.badge}>{backend === 'pending' ? '…' : backend}</span>
    </footer>
  );
};
