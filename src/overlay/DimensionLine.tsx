import { formatDelta, formatMetres } from '../format';
import { measure } from '../model/geometry/measure';
import type { Vec2 } from '../model/types';
import type { ScreenPoint } from '../viewport/viewportMath';

import styles from './Overlay.module.css';
import { useWorldToScreen } from './useWorldToScreen';

const TICK = 6;
const LABEL_OFFSET = 14;

interface DimensionLineProps {
  a: Vec2;
  b: Vec2;
  /** Show Δx/Δz below the line (noise for axis-aligned lines). */
  showDelta?: boolean;
}

/** Dimension line from `a` to `b` with end ticks, a length label above and Δx/Δz below. */
export const DimensionLine = ({ a, b, showDelta = true }: DimensionLineProps) => {
  const toScreen = useWorldToScreen();
  const sa = toScreen(a);
  const sb = toScreen(b);
  const { length, dx, dz } = measure(a, b);

  const angle = Math.atan2(sb.y - sa.y, sb.x - sa.x);
  // Unit perpendicular to the line, for the end ticks.
  const perp = { x: -Math.sin(angle), y: Math.cos(angle) };
  // Text never reads upside down, and vertical lines always read bottom-to-top.
  const textAngle = readableAngle(angle);
  // Points "above" the text baseline, whichever way the line goes.
  const up = { x: Math.sin(textAngle), y: -Math.cos(textAngle) };
  const mid = { x: (sa.x + sb.x) / 2, y: (sa.y + sb.y) / 2 };
  const textDeg = (textAngle * 180) / Math.PI;

  return (
    <g>
      <line className={styles.dimLine} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />
      <Tick at={sa} perp={perp} />
      <Tick at={sb} perp={perp} />
      <Label
        className={styles.label}
        at={offset(mid, up, LABEL_OFFSET)}
        deg={textDeg}
        text={formatMetres(length)}
      />
      {showDelta && (
        <Label
          className={styles.labelSecondary}
          at={offset(mid, up, -LABEL_OFFSET)}
          deg={textDeg}
          text={formatDelta(dx, dz)}
        />
      )}
    </g>
  );
};

const Tick = ({ at, perp }: { at: ScreenPoint; perp: ScreenPoint }) => (
  <line
    className={styles.tick}
    x1={at.x - perp.x * TICK}
    y1={at.y - perp.y * TICK}
    x2={at.x + perp.x * TICK}
    y2={at.y + perp.y * TICK}
  />
);

interface LabelProps {
  className: string | undefined;
  at: ScreenPoint;
  deg: number;
  text: string;
}

const Label = ({ className, at, deg, text }: LabelProps) => (
  <text
    className={className}
    x={at.x}
    y={at.y}
    transform={`rotate(${deg} ${at.x} ${at.y})`}
    paintOrder="stroke"
  >
    {text}
  </text>
);

/** Folds an angle into [−90°, 90°), so labels read left-to-right or bottom-to-top. */
const readableAngle = (angle: number): number => {
  if (angle >= Math.PI / 2) return angle - Math.PI;
  if (angle < -Math.PI / 2) return angle + Math.PI;
  return angle;
};

const offset = (p: ScreenPoint, dir: ScreenPoint, distance: number): ScreenPoint => ({
  x: p.x + dir.x * distance,
  y: p.y + dir.y * distance,
});
