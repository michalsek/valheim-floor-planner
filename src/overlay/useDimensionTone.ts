import { useAtomValue } from 'jotai';

import { isSelected } from '../model/selection';
import type { DimId } from '../model/types';
import { useActiveToolId } from '../store/hooks';
import { hoverAtom, selectionAtom } from '../store/selection';

import type { DimensionTone } from './DimensionLine';

/**
 * How each pinned dimension is drawn: a selected one in the selection colour; a hovered
 * one highlighted, or red in the Dimension tool, where Delete would remove it.
 */
export const useDimensionTone = (): ((id: DimId) => DimensionTone) => {
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const deletes = useActiveToolId() === 'dimension';
  return (id) => {
    const hovered = hover?.kind === 'dimension' && hover.id === id;
    if (hovered && deletes) return 'danger';
    if (isSelected(selection, { kind: 'dimension', id })) return 'selected';
    return hovered ? 'hover' : 'pinned';
  };
};
