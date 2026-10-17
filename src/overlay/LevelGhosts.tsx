import { propsInDrawOrder } from '../model/props';
import { getLibrary } from '../store/libraryInstance';
import { useGhostPlan } from '../store/planHooks';

import styles from './Overlay.module.css';
import { PropFootprint } from './PropFootprints';

/**
 * The items of the level below, faintly, under the current level's (world layer, drawn
 * first); its walls and floors are `GhostMeshes`.
 */
export const LevelGhosts = () => {
  const props = propsInDrawOrder(useGhostPlan(), getLibrary().propDefs);
  if (props.length === 0) return null;
  return (
    <g className={styles.ghostLevel}>
      {props.map((prop) => (
        <PropFootprint key={prop.id} prop={prop} />
      ))}
    </g>
  );
};
