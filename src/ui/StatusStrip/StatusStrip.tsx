import { useAtom } from 'jotai';

import { ToggleButton } from '../../controls/ToggleButton';
import { formatLevel, formatNumber, formatZoom } from '../../format';
import { isRawRoofCover } from '../../model/rawBoxes';
import { groundAt } from '../../model/terrain/siteTerrain';
import type { Plan } from '../../model/types';
import { useCursor, useRendererBackend, useViewMode, useViewport } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { usePlanSelector } from '../../store/planHooks';
import { roofsVisibleAtom, showAllRadiiAtom, underlayVisibleAtom } from '../../store/session';
import { useShownSiteTerrain } from '../../store/siteTerrain';

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

/**
 * The plan height of the shown terrain under the cursor ("ground +0.6 m", "ground —" off
 * the patch); null without shown terrain.
 */
const useGroundReadout = (): string | null => {
  const cursor = useCursor();
  const site = useShownSiteTerrain();
  if (!site) return null;
  const h = cursor && groundAt(site.grid, site.frame, cursor.raw);
  return `ground ${h === null ? '—' : formatLevel(Math.round(h * 10) / 10)}`;
};

/** The cursor on the plan (the work plane in 3D), the ground there, the 2D zoom, the snap step. */
const PlanReadouts = ({ is2d }: { is2d: boolean }) => {
  const cursor = useCursor();
  const ground = useGroundReadout();
  const { zoom } = useViewport();
  return (
    <>
      <span className={styles.coords}>
        {cursor
          ? `x ${formatNumber(cursor.snapped.x)}  z ${formatNumber(cursor.snapped.z)} m`
          : '—'}
      </span>
      {ground && (
        <span className={styles.ground} title="The terrain's height under the cursor (plan height)">
          {ground}
        </span>
      )}
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
