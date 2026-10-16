/** How 3D boxes are coloured: a base colourer, and the selection / hover tint over it. */
import { floorColor, materialColor, mixHex } from '../../catalog/materialColors';
import { hitItem, type Hit } from '../../model/hitTest';
import type { PieceBox } from '../../model/pieceBoxes';
import type { Selection, SelectionItem } from '../../model/selection';
import type { ThemeTokens } from '../../theme/themeTokens';

/** A box's colour, `#rrggbb`. */
export type PieceColorer = (box: PieceBox) => string;

/** Share of the selection colour in a selected and in a hovered piece. */
const SELECTED_MIX = 0.7;
const HOVER_MIX = 0.35;

/** The plan colours: materials, the floor checkerboard and prop groups. */
export const materialColorer =
  ({ palette, propGroups }: ThemeTokens): PieceColorer =>
  (box) => {
    switch (box.kind) {
      case 'floor':
        return floorColor(palette, box.material ?? '', box.odd);
      case 'prop':
        return propGroups[box.group ?? 'fallback'];
      default:
        return materialColor(palette, box.material);
    }
  };

const itemKey = (item: SelectionItem): string => `${item.kind}:${item.id}`;

/** `colorer`, with selected items and the hovered one tinted towards the selection colour. */
export const withHighlight = (
  colorer: PieceColorer,
  selection: Selection,
  hover: Hit | null,
  tokens: ThemeTokens
): PieceColorer => {
  if (selection.length === 0 && !hover) return colorer;
  const selected = new Set(selection.map(itemKey));
  const hovered = hover ? itemKey(hitItem(hover)) : null;
  return (box) => {
    const key = itemKey(box.item);
    if (selected.has(key)) return mixHex(colorer(box), tokens.selection, SELECTED_MIX);
    if (key === hovered) return mixHex(colorer(box), tokens.selection, HOVER_MIX);
    return colorer(box);
  };
};
