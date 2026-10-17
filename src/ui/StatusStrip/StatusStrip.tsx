import { useAtom } from 'jotai';

import { ToggleButton } from '../../controls/ToggleButton';
import { formatNumber, formatZoom } from '../../format';
import type { Plan } from '../../model/types';
import { useCursor, useRendererBackend, useViewMode, useViewport } from '../../store/hooks';
import { usePlanSelector } from '../../store/planHooks';
import { roofsVisibleAtom, showAllRadiiAtom, underlayVisibleAtom } from '../../store/session';

import { InstallMenu } from './InstallMenu';
import { ModelToggle } from './ModelToggle';
import { SnapStepPicker } from './SnapStepPicker';
import styles from './StatusStrip.module.css';
import { ThemePicker } from './ThemePicker';
import { ViewToggle } from './ViewToggle';

const hasUnderlay = (plan: Plan) => plan.underlay !== null;
const hasRoofs = (plan: Plan) => Object.keys(plan.roofs).length > 0;

/** Show every ring, roofs (when there are any), and the underlay (when there is one). */
const LayerToggles = () => {
  const [showAll, setShowAll] = useAtom(showAllRadiiAtom);
  const [roofsVisible, setRoofsVisible] = useAtom(roofsVisibleAtom);
  const roofs = usePlanSelector(hasRoofs);
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
      {roofs && (
        <ToggleButton
          title="Show roofs (hide them to see and pick inside the house)"
          pressed={roofsVisible}
          onChange={setRoofsVisible}
        >
          Roofs
        </ToggleButton>
      )}
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

/** The cursor on the plan (the work plane in 3D), the 2D zoom and the snap step. */
const PlanReadouts = ({ is2d }: { is2d: boolean }) => {
  const cursor = useCursor();
  const { zoom } = useViewport();
  return (
    <>
      <span className={styles.coords}>
        {cursor
          ? `x ${formatNumber(cursor.snapped.x)}  z ${formatNumber(cursor.snapped.z)} m`
          : '—'}
      </span>
      {is2d && <span>{formatZoom(zoom)}</span>}
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
      <PlanReadouts is2d={is2d} />
      <LayerToggles />
      {!is2d && <ModelToggle />}
      <span className={styles.spacer} />
      <ThemePicker />
      <InstallMenu />
      <span className={styles.badge}>{backend === 'pending' ? '…' : backend}</span>
    </footer>
  );
};
