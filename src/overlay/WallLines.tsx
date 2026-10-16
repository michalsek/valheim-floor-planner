import { useViewport } from '../store/hooks';
import { useDerivedPlan, usePlan } from '../store/planHooks';

import styles from './Overlay.module.css';
import { PieceFootprints } from './PieceFootprints';
import { RunPath } from './RunPath';

/**
 * Below this zoom the meshes get too thin to read (a 0.3 m wall is under 4 px), so
 * the footprints are drawn here too, with a stroke that keeps them at least 2 px wide.
 */
const FAR_ZOOM = 12;

/** Thin lines along committed runs, plus solid footprints when zoomed far out. */
export const WallLines = () => {
  const { walls } = usePlan();
  const { pieces } = useDerivedPlan();
  const { zoom } = useViewport();

  return (
    <g>
      {zoom <= FAR_ZOOM && <PieceFootprints pieces={pieces} className={styles.pieceFar} solid />}
      {Object.values(walls).map((wall) => (
        <RunPath
          key={wall.id}
          points={wall.points}
          closed={wall.closed}
          className={styles.wallLine}
        />
      ))}
    </g>
  );
};
