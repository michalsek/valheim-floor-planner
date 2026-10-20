import type { Vec2 } from '../model/types';

import styles from './Overlay.module.css';
import { useProject3d } from './useProject3d';

interface Marker3dProps {
  at: Vec2;
  /** Radius in screen px. */
  r: number;
  className?: string | undefined;
}

/**
 * A constant-size dot or ring on a plan point, at the overlay's height (hidden behind
 * the camera).
 */
export const Marker3d = ({ at, r, className = styles.marker }: Marker3dProps) => {
  const p = useProject3d()(at);
  return p ? <circle className={className} cx={p.x} cy={p.y} r={r} /> : null;
};
