import { isAxisAligned } from '../model/geometry/dimension';
import { useLevelPlan } from '../store/planHooks';

import { DimensionLine } from './DimensionLine';
import { useDimensionTone } from './useDimensionTone';

/** Dimensions stored in the plan (as drawn, so a move previews), toned by `useDimensionTone`. */
export const PinnedDimensions = () => {
  const { dimensions } = useLevelPlan();
  const toneOf = useDimensionTone();

  return (
    <g>
      {Object.values(dimensions).map(({ id, a, b, offset }) => (
        <DimensionLine
          key={id}
          a={a}
          b={b}
          offset={offset}
          showDelta={!isAxisAligned(a, b)}
          tone={toneOf(id)}
        />
      ))}
    </g>
  );
};
