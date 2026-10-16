import { formatDelta, formatMetres } from '../format';
import { dimensionLine } from '../model/geometry/dimension';
import { measure } from '../model/geometry/measure';
import type { Vec2 } from '../model/types';
import type { ScreenPoint } from '../viewport/viewportMath';

import styles from './Overlay.module.css';
import { useWorldToScreen } from './useWorldToScreen';

const TICK = 6;
const LABEL_OFFSET = 14;
/** Extension lines run this far past the dimension line. */
const OVERSHOOT = 4;

/**
 * live: being measured; pinned: stored in the plan; selected / hover: in the Select
 * tool; danger: Delete or Alt+click removes it.
 */
export type DimensionTone = 'live' | 'pinned' | 'selected' | 'hover' | 'danger';

const TONE_CLASS: Record<DimensionTone, string> = {
  live: '',
  pinned: styles.tonePinned ?? '',
  selected: styles.toneSelected ?? '',
  hover: styles.toneHover ?? '',
  danger: styles.toneDanger ?? '',
};

interface DimensionLineProps {
  a: Vec2;
  b: Vec2;
  /** Draws the line this many metres to the right of a→b, with extension lines. */
  offset?: number;
  /** Show Δx/Δz below the line (noise for axis-aligned lines). */
  showDelta?: boolean;
  tone?: DimensionTone;
}

/**
 * Dimension line for `a`→`b` with end ticks, a length label above and Δx/Δz below.
 * With an offset, the line is moved aside and extension lines lead back to the points.
 */
export const DimensionLine = ({
  a,
  b,
  offset = 0,
  showDelta = true,
  tone = 'live',
}: DimensionLineProps) => {
  const toScreen = useWorldToScreen();
  const line = dimensionLine({ a, b, offset });
  const sa = toScreen(line.a);
  const sb = toScreen(line.b);
  const { length, dx, dz } = measure(a, b);
  const toneClass = TONE_CLASS[tone];

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
      {offset !== 0 && (
        <>
          <Extension from={toScreen(a)} to={sa} className={toneClass} />
          <Extension from={toScreen(b)} to={sb} className={toneClass} />
        </>
      )}
      <line className={`${styles.dimLine} ${toneClass}`} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />
      <Tick at={sa} perp={perp} className={toneClass} />
      <Tick at={sb} perp={perp} className={toneClass} />
      <Label
        className={tone === 'danger' ? `${styles.label} ${styles.labelDanger}` : styles.label}
        at={shift(mid, up, LABEL_OFFSET)}
        deg={textDeg}
        text={formatMetres(length)}
      />
      {showDelta && (
        <Label
          className={styles.labelSecondary}
          at={shift(mid, up, -LABEL_OFFSET)}
          deg={textDeg}
          text={formatDelta(dx, dz)}
        />
      )}
    </g>
  );
};

/** From a measured point to just past the dimension line. */
const Extension = ({
  from,
  to,
  className,
}: {
  from: ScreenPoint;
  to: ScreenPoint;
  className: string;
}) => {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1) return null;
  const end = shift(to, { x: (to.x - from.x) / length, y: (to.y - from.y) / length }, OVERSHOOT);
  return (
    <line
      className={`${styles.dimLine} ${styles.extension} ${className}`}
      x1={from.x}
      y1={from.y}
      x2={end.x}
      y2={end.y}
    />
  );
};

const Tick = ({
  at,
  perp,
  className,
}: {
  at: ScreenPoint;
  perp: ScreenPoint;
  className: string;
}) => (
  <line
    className={`${styles.tick} ${className}`}
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

const shift = (p: ScreenPoint, dir: ScreenPoint, distance: number): ScreenPoint => ({
  x: p.x + dir.x * distance,
  y: p.y + dir.y * distance,
});
