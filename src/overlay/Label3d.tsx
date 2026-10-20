import type { Vec2 } from '../model/types';

import styles from './Overlay.module.css';
import { useProject3d } from './useProject3d';

interface Label3dProps {
  /** A plan point on the overlay's plane (`OverlayPlaneContext`). */
  at: Vec2;
  text: string;
  /** Screen px above the point. */
  above?: number;
  className?: string | undefined;
}

/** Text over a plan point at the overlay's height (hidden while the point is behind the camera). */
export const Label3d = ({ at, text, above = 0, className = styles.label }: Label3dProps) => {
  const p = useProject3d()(at);
  if (!p) return null;
  return (
    <text className={className} x={p.x} y={p.y - above} paintOrder="stroke">
      {text}
    </text>
  );
};
