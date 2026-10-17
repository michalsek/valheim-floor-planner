/**
 * How 3D boxes are coloured: a base colourer (materials, or support), pieces off the
 * current level faded, and the selection / hover tint over it.
 */
import { floorColor, materialColor, mixHex } from '../../catalog/materialColors';
import { hitItem, type Hit } from '../../model/hitTest';
import type { PieceBox } from '../../model/pieceBoxes';
import type { Selection, SelectionItem } from '../../model/selection';
import type { PlanSupport } from '../../model/support/planSupport';
import type { ThemeTokens } from '../../theme/themeTokens';
import { bandOf, supportBandColor } from '../supportColors';

/** A box's colour, `#rrggbb`. */
export type PieceColorer = (box: PieceBox) => string;

/** Share of the selection colour in a selected and in a hovered piece. */
const SELECTED_MIX = 0.7;
const HOVER_MIX = 0.35;
/** How far a piece off the current level fades towards the canvas colour. */
const OFF_LEVEL_MIX = 0.4;

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

/**
 * Colours by support band; pieces that take no part (or before support is worked out)
 * keep `fallback`'s colour.
 */
export const supportColorer =
  (support: PlanSupport | null, tokens: ThemeTokens, fallback: PieceColorer): PieceColorer =>
  (box) =>
    supportBandColor(tokens, bandOf(support, box.key)) ?? fallback(box);

/** `colorer`, with pieces not on the current level faded towards the canvas. */
export const withLevel =
  (colorer: PieceColorer, onLevel: (box: PieceBox) => boolean, tokens: ThemeTokens): PieceColorer =>
  (box) =>
    onLevel(box) ? colorer(box) : mixHex(colorer(box), tokens.canvas, OFF_LEVEL_MIX);

const itemKey = (item: SelectionItem): string => `${item.kind}:${item.id}`;

/**
 * `colorer`, with selected items and the hovered one tinted towards `tint` (the selection
 * colour; neutral in the support view, where pink would read as collapsing).
 */
export const withHighlight = (
  colorer: PieceColorer,
  selection: Selection,
  hover: Hit | null,
  tint: string
): PieceColorer => {
  if (selection.length === 0 && !hover) return colorer;
  const selected = new Set(selection.map(itemKey));
  const hovered = hover ? itemKey(hitItem(hover)) : null;
  return (box) => {
    const key = itemKey(box.item);
    if (selected.has(key)) return mixHex(colorer(box), tint, SELECTED_MIX);
    if (key === hovered) return mixHex(colorer(box), tint, HOVER_MIX);
    return colorer(box);
  };
};
