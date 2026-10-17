import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { PropFootprint } from '../../overlay/PropFootprints';
import { RadiusRing } from '../../overlay/RadiusRings';

import { useGhostSteps } from './propFlight';
import { propGhostAtom } from './propState';

/** The armed prop's footprint where a click would place it (a stair's whole flight). */
export const PropWorldPreview = () => {
  const ghost = useAtomValue(propGhostAtom);
  const steps = useGhostSteps();
  if (!ghost) return null;
  return (
    <>
      {steps.map((step, i) => (
        <PropFootprint
          key={i}
          prop={{ prefab: ghost.def.prefab, ...step }}
          className={styles.propGhost}
        />
      ))}
    </>
  );
};

/** The armed station's or ward's ring (screen layer). */
export const PropPreview = () => {
  const ghost = useAtomValue(propGhostAtom);
  if (!ghost) return null;
  return <RadiusRing prop={{ prefab: ghost.def.prefab, position: ghost.position, upgrades: 0 }} />;
};
