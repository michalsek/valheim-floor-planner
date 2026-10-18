/** The Build label and snap marks in screen px, shared by the 3D overlay and the 2D one. */
import type { Vec3 } from '../../model/types';
import styles from '../../overlay/Overlay.module.css';
import { useThemeTokens } from '../../store/hooks';
import type { ScreenPoint } from '../../viewport/viewportMath';

import type { BuildGhost } from './buildGhost';
import type { LabelLine } from './buildLabel';

/** Gap (px) over the anchor point, and between label lines. */
const LABEL_GAP = 16;
const LINE_HEIGHT = 16;
const DOT_PX = 3;
const MANUAL_PX = 4.5;
const RING_PX = 8;

/** Label lines stacked upwards from a gap over a screen point, warnings in amber. */
export const LabelLines = ({ at, lines }: { at: ScreenPoint; lines: readonly LabelLine[] }) =>
  lines.map((line, i) => (
    <text
      key={i}
      className={line.warn ? `${styles.label} ${styles.labelWarn}` : styles.label}
      x={at.x}
      y={at.y - LABEL_GAP - (lines.length - 1 - i) * LINE_HEIGHT}
      paintOrder="stroke"
    >
      {line.text}
    </text>
  ));

interface SnapDotsProps {
  ghost: BuildGhost;
  project: (p: Vec3) => ScreenPoint | null;
  color: string;
}

/** The ghost's snap points as dots, the manual one filled, the snapped pair ringed. */
export const SnapDots = ({ ghost, project, color }: SnapDotsProps) => {
  const { ink } = useThemeTokens();
  const pair = ghost.pair && project(ghost.pair.target.point);
  return (
    <>
      {ghost.snaps.map((snap, i) => {
        const p = project(snap.point);
        if (!p) return null;
        const manual = ghost.manual === i;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={manual ? MANUAL_PX : DOT_PX}
            fill={manual ? color : 'none'}
            stroke={color}
            strokeWidth={1.5}
          />
        );
      })}
      {pair && (
        <circle
          cx={pair.x}
          cy={pair.y}
          r={RING_PX}
          fill="none"
          stroke={ink.accent}
          strokeWidth={2}
        />
      )}
    </>
  );
};
