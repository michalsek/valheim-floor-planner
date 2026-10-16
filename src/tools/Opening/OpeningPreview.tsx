import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';

import { openingHoverAtom } from './openingState';

/** Gap (px) between the opening and the reason it can't go there. */
const LABEL_GAP = 22;

/** Why a click here would do nothing ("needs 2 m, 1 m free"), next to the opening. */
export const OpeningPreview = () => {
  const placement = useAtomValue(openingHoverAtom);
  const toScreen = useWorldToScreen();
  if (!placement?.reason) return null;
  const p = toScreen(placement.center);
  return (
    <text
      className={`${styles.label} ${styles.labelDanger}`}
      x={p.x}
      y={p.y - LABEL_GAP}
      paintOrder="stroke"
    >
      {placement.reason}
    </text>
  );
};
