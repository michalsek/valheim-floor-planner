import { useAtomValue } from 'jotai';

import type { Crease } from '../model/roofs/roofCells';
import { roofGeometry } from '../model/roofs/roofGeometry';
import type { Roof, Vec2 } from '../model/types';
import { useLevelPlan } from '../store/planHooks';
import { roofsVisibleAtom } from '../store/session';

import styles from './Overlay.module.css';
import { RunPath } from './RunPath';

/** An arrowhead's arms (metres) and their angle off the shaft. */
const HEAD = 0.45;
const HEAD_ANGLE = Math.PI / 7;

const Segments = ({
  lines,
  className,
}: {
  lines: readonly Crease[];
  className: string | undefined;
}) => (
  <>
    {lines.map(({ a, b }, i) => (
      <line
        key={i}
        className={className}
        x1={a.x}
        y1={a.z}
        x2={b.x}
        y2={b.z}
        vectorEffect="non-scaling-stroke"
      />
    ))}
  </>
);

/** The two arms of an arrowhead at `b`, for a shaft from `a`. */
const arrowHead = ({ a, b }: Crease): Crease[] => {
  const angle = Math.atan2(a.z - b.z, a.x - b.x);
  const arm = (turn: number): Crease => {
    const end: Vec2 = {
      x: b.x + HEAD * Math.cos(angle + turn),
      z: b.z + HEAD * Math.sin(angle + turn),
    };
    return { a: b, b: end };
  };
  return [arm(HEAD_ANGLE), arm(-HEAD_ANGLE)];
};

/**
 * One roof on the plan (world layer): a faint fill over the eave ring, the ring dashed,
 * ridges bold, hips thin, valleys dashed, and an arrow down each slope.
 */
export const RoofShape = ({ roof, className }: { roof: Roof; className?: string | undefined }) => {
  const { frame, creases, arrows } = roofGeometry(roof);
  return (
    <g className={className}>
      <RunPath points={frame.ring} closed className={styles.roofFill} />
      <RunPath points={frame.ring} closed className={styles.roofEave} />
      <Segments lines={creases.hips} className={styles.roofHip} />
      <Segments lines={creases.valleys} className={styles.roofValley} />
      <Segments lines={creases.ridges} className={styles.roofRidge} />
      <Segments lines={[...arrows, ...arrows.flatMap(arrowHead)]} className={styles.roofArrow} />
    </g>
  );
};

/** The current level's roofs (unless roofs are hidden). */
export const RoofLayer = () => {
  const { roofs } = useLevelPlan();
  const visible = useAtomValue(roofsVisibleAtom);
  if (!visible) return null;
  return (
    <g>
      {Object.values(roofs).map((roof) => (
        <RoofShape key={roof.id} roof={roof} />
      ))}
    </g>
  );
};
