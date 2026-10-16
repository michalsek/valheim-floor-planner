import { useAtomValue } from 'jotai';

import { isAxisAligned } from '../model/geometry/dimension';
import { isSelected } from '../model/selection';
import type { DimId } from '../model/types';
import { useActiveToolId } from '../store/hooks';
import { useDisplayPlan } from '../store/planHooks';
import { hoverAtom, selectionAtom } from '../store/selection';

import { DimensionLine, type DimensionTone } from './DimensionLine';

/**
 * Dimensions stored in the plan (as drawn, so a move previews). A selected one is in
 * the selection colour; a hovered one is highlighted, or red in the Dimension tool, where
 * Delete would remove it.
 */
export const PinnedDimensions = () => {
  const { dimensions } = useDisplayPlan();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const deletes = useActiveToolId() === 'dimension';

  const toneOf = (id: DimId): DimensionTone => {
    const hovered = hover?.kind === 'dimension' && hover.id === id;
    if (hovered && deletes) return 'danger';
    if (isSelected(selection, { kind: 'dimension', id })) return 'selected';
    return hovered ? 'hover' : 'pinned';
  };

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
