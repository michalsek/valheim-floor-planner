import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { PropFootprint } from '../../overlay/PropFootprints';
import { RadiusRing } from '../../overlay/RadiusRings';

import { propGhostAtom } from './propState';

/** The armed prop's footprint where a click would place it (world layer). */
export const PropWorldPreview = () => {
  const ghost = useAtomValue(propGhostAtom);
  if (!ghost) return null;
  const prop = { prefab: ghost.def.prefab, position: ghost.position, rotation: ghost.rotation };
  return <PropFootprint prop={prop} className={styles.propGhost} />;
};

/** The armed station's or ward's ring (screen layer). */
export const PropPreview = () => {
  const ghost = useAtomValue(propGhostAtom);
  if (!ghost) return null;
  return <RadiusRing prop={{ prefab: ghost.def.prefab, position: ghost.position, upgrades: 0 }} />;
};
