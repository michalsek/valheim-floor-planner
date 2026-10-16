import { useAtomValue } from 'jotai';

import { isAxisAligned } from '../model/geometry/dimension';
import type { Plan } from '../model/types';
import { usePlanSelector } from '../store/planHooks';
import { dimensionHoverIdAtom } from '../tools/Dimension/dimensionState';

import { DimensionLine } from './DimensionLine';

const dimensionsOf = (plan: Plan) => plan.dimensions;

/** Dimensions stored in the plan; the hovered one shows that Delete would remove it. */
export const PinnedDimensions = () => {
  const dimensions = usePlanSelector(dimensionsOf);
  const hoverId = useAtomValue(dimensionHoverIdAtom);
  return (
    <g>
      {Object.values(dimensions).map(({ id, a, b, offset }) => (
        <DimensionLine
          key={id}
          a={a}
          b={b}
          offset={offset}
          showDelta={!isAxisAligned(a, b)}
          tone={id === hoverId ? 'danger' : 'pinned'}
        />
      ))}
    </g>
  );
};
