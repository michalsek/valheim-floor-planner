import { useAtomValue } from 'jotai';

import { formatMetres } from '../format';
import { sameLevel } from '../model/elevation';
import { dimensionLine } from '../model/geometry/dimension';
import { measure } from '../model/geometry/measure';
import type { Vec2 } from '../model/types';
import { useCutPlan } from '../store/planHooks';
import { workPlaneAtom } from '../store/session';

import type { DimensionTone } from './DimensionLine';
import { Label3d } from './Label3d';
import styles from './Overlay.module.css';
import { useDimensionTone } from './useDimensionTone';
import { OverlayPlaneContext } from './useProject3d';

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

/** The pinned dimensions' lengths below the cut, each at its own height (lines: `Dimensions3d`). */
export const PinnedDimensionLabels3d = () => {
  const { dimensions } = useCutPlan();
  const toneOf = useDimensionTone();
  const plane = useAtomValue(workPlaneAtom);
  return (
    <g>
      {Object.values(dimensions).map(({ id, a, b, offset, elevation }) => (
        <OverlayPlaneContext key={id} value={elevation}>
          <g className={sameLevel(elevation, plane) ? undefined : styles.offLevel}>
            <DimensionLabel3d a={a} b={b} offset={offset} tone={toneOf(id)} />
          </g>
        </OverlayPlaneContext>
      ))}
    </g>
  );
};
