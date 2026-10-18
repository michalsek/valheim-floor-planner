import { propsInDrawOrder } from '../model/props';
import { getLibrary } from '../store/libraryInstance';
import { useGhostPlan } from '../store/planHooks';

import styles from './Footprints.module.css';
import { PropFootprint } from './PropFootprints';
import { RawGhosts } from './RawFootprints';

/**
 * The items of the level below, as neutral dashed outlines under the current level's
 * (world layer, drawn first); its walls and floors are `GhostMeshes`.
 */
export const LevelGhosts = () => {
  const ghost = useGhostPlan();
  const props = propsInDrawOrder(ghost, getLibrary().propDefs);
  if (props.length === 0 && Object.keys(ghost.rawPieces).length === 0) return null;
  return (
    <g className={styles.ghostLevel}>
      <RawGhosts />
      {props.map((prop) => (
        <PropFootprint key={prop.id} prop={prop} />
      ))}
    </g>
  );
};
