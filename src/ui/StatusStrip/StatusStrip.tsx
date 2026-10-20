import { useAtom } from 'jotai';

import { ToggleButton } from '../../controls/ToggleButton';
import { formatHeight, formatNumber, formatZoom } from '../../format';
import { isRawRoofCover } from '../../model/rawBoxes';
import type { Plan } from '../../model/types';
import { useCursor, useRendererBackend, useViewMode, useViewport } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { usePlanSelector } from '../../store/planHooks';
import { roofsVisibleAtom, showAllRadiiAtom, underlayVisibleAtom } from '../../store/session';

import { GridFrameButton } from './GridFrameButton';
import { InstallMenu } from './InstallMenu';
import { ModelToggle } from './ModelToggle';
import { SnapStepPicker } from './SnapStepPicker';
import styles from './StatusStrip.module.css';
import { TerrainToggle } from './TerrainToggle';
import { ThemePicker } from './ThemePicker';
import { ViewToggle } from './ViewToggle';
import { WorldButton } from '../WorldPanel/WorldButton';

const hasUnderlay = (plan: Plan) => plan.underlay !== null;
const hasRoofs = (plan: Plan) =>
  Object.values(plan.rawPieces).some((piece) => isRawRoofCover(piece, getLibrary()));

/**
 * Show every ring, roofs (when there are any), the underlay (when there is one), the
 * imported site's terrain, and the import's grid.
 */
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
      <TerrainToggle />
      <GridFrameButton />
    </>
  );
};

/** The height of the surface under the cursor ("y +0.6 m"; "y —" without a cursor). */
const useSurfaceReadout = (): string => {
  const cursor = useCursor();
  return `y ${cursor ? formatHeight(Math.round(cursor.y * 10) / 10) : '—'}`;
};

/** The cursor on the plan, the surface's height there, the 2D zoom, the snap step. */
const PlanReadouts = ({ is2d }: { is2d: boolean }) => {
  const cursor = useCursor();
  const surface = useSurfaceReadout();
  const { zoom } = useViewport();
  return (
    <>
      <span className={styles.coords}>
        {cursor
          ? `x ${formatNumber(cursor.snapped.x)}  z ${formatNumber(cursor.snapped.z)} m`
          : '—'}
      </span>
      {/* Always there, so the strip doesn't shift as the pointer leaves the canvas. */}
      <span
        className={styles.surface}
        title="The height of the surface under the cursor (where items and dimensions go)"
      >
        {surface}
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
      <WorldButton />
      <InstallMenu />
      <span className={styles.badge}>{backend === 'pending' ? '…' : backend}</span>
    </footer>
  );
};
