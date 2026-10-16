import { formatMetres } from '../format';
import { dimensionLine } from '../model/geometry/dimension';
import { measure } from '../model/geometry/measure';
import type { Vec2 } from '../model/types';
import { useDisplayPlan } from '../store/planHooks';

import type { DimensionTone } from './DimensionLine';
import { Label3d } from './Label3d';
import styles from './Overlay.module.css';
import { useDimensionTone } from './useDimensionTone';

/** Gap (px) between a dimension line and its length. */
const LABEL_ABOVE = 12;

interface DimensionLabel3dProps {
  a: Vec2;
  b: Vec2;
  offset?: number;
  tone?: DimensionTone;
}

/** A dimension's length, over the middle of its line. */
export const DimensionLabel3d = ({ a, b, offset = 0, tone = 'live' }: DimensionLabel3dProps) => {
  const line = dimensionLine({ a, b, offset });
  const mid = { x: (line.a.x + line.b.x) / 2, z: (line.a.z + line.b.z) / 2 };
  const className = tone === 'danger' ? `${styles.label} ${styles.labelDanger}` : styles.label;
  return (
    <Label3d
      at={mid}
      text={formatMetres(measure(a, b).length)}
      above={LABEL_ABOVE}
      className={className}
    />
  );
};

/** The pinned dimensions' lengths (their lines are `Dimensions3d`). */
export const PinnedDimensionLabels3d = () => {
  const { dimensions } = useDisplayPlan();
  const toneOf = useDimensionTone();
  return (
    <g>
      {Object.values(dimensions).map(({ id, a, b, offset }) => (
        <DimensionLabel3d key={id} a={a} b={b} offset={offset} tone={toneOf(id)} />
      ))}
    </g>
  );
};
