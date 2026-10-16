import type { Vec2 } from '../model/types';

import styles from './Overlay.module.css';
import { useWorldToScreen } from './useWorldToScreen';

/** A small dot at a world point (e.g. a ruler's first point while the pointer is away). */
export const PointMarker = ({ p }: { p: Vec2 }) => {
  const { x, y } = useWorldToScreen()(p);
  return <circle className={styles.marker} cx={x} cy={y} r={3} />;
};
