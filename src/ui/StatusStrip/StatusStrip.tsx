import { useAtom } from 'jotai';

import { ToggleButton } from '../../controls/ToggleButton';
import { formatNumber, formatZoom } from '../../format';
import type { Plan } from '../../model/types';
import { useCursor, useRendererBackend, useViewMode, useViewport } from '../../store/hooks';
import { usePlanSelector } from '../../store/planHooks';
import { showAllRadiiAtom, underlayVisibleAtom } from '../../store/session';

import { InstallMenu } from './InstallMenu';
import { SnapStepPicker } from './SnapStepPicker';
import styles from './StatusStrip.module.css';
import { ThemePicker } from './ThemePicker';
import { ViewToggle } from './ViewToggle';

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

/** The 2D cursor, zoom and snap step (meaningless in 3D). */
const PlanReadouts = () => {
  const cursor = useCursor();
  const { zoom } = useViewport();
  return (
    <>
      <span className={styles.coords}>
        {cursor
          ? `x ${formatNumber(cursor.snapped.x)}  z ${formatNumber(cursor.snapped.z)} m`
          : '—'}
      </span>
      <span>{formatZoom(zoom)}</span>
      <SnapStepPicker />
    </>
  );
};

export const StatusStrip = () => {
  const backend = useRendererBackend();
  const is2d = useViewMode() === '2d';

  return (
    <footer className={styles.strip}>
      <ViewToggle />
      {is2d && <PlanReadouts />}
      <LayerToggles />
      <span className={styles.spacer} />
      <ThemePicker />
      <InstallMenu />
      <span className={styles.badge}>{backend === 'pending' ? '…' : backend}</span>
    </footer>
  );
};
