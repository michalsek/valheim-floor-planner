/**
 * How 3D boxes are coloured: a base colourer (materials, or support), pieces off the
 * current level faded, the level the Levels bar previews tinted, and the selection /
 * hover tint over it. Models are tinted the
 * same way, over their textures.
 */
import { materialColor, mixHex } from '../../catalog/materialColors';
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

/** The plan colours: materials and prop groups. */
export const materialColorer =
  ({ palette, propGroups }: ThemeTokens): PieceColorer =>
  (box) =>
    box.kind === 'prop'
      ? propGroups[box.group ?? 'fallback']
      : materialColor(palette, box.material);

/**
 * Colours by support band; pieces that take no part (or before support is worked out)
 * keep `fallback`'s colour.
 */
export const supportColorer =
  (support: PlanSupport | null, tokens: ThemeTokens, fallback: PieceColorer): PieceColorer =>
  (box) =>
    supportBandColor(tokens, bandOf(support, box.key)) ?? fallback(box);

/** A shade mixed towards a colour (`#rrggbb`) by a share in [0, 1]. */
type Mixer<S> = (shade: S, color: string, share: number) => S;
type Shader<S> = (box: PieceBox) => S;

const levelled =
  <S>(mix: Mixer<S>) =>
  (shade: Shader<S>, faded: (box: PieceBox) => boolean, tokens: ThemeTokens): Shader<S> =>
  (box) =>
    faded(box) ? mix(shade(box), tokens.canvas, OFF_LEVEL_MIX) : shade(box);

const levelHovered =
  <S>(mix: Mixer<S>) =>
  (shade: Shader<S>, hovered: ((box: PieceBox) => boolean) | null, tint: string): Shader<S> =>
    hovered ? (box) => (hovered(box) ? mix(shade(box), tint, HOVER_MIX) : shade(box)) : shade;

const itemKey = (item: SelectionItem): string => `${item.kind}:${item.id}`;

const highlighted =
  <S>(mix: Mixer<S>) =>
  (shade: Shader<S>, selection: Selection, hover: Hit | null, tint: string): Shader<S> => {
    if (selection.length === 0 && !hover) return shade;
    const selected = new Set(selection.map(itemKey));
    const hovered = hover ? itemKey(hitItem(hover)) : null;
    return (box) => {
      const key = itemKey(box.item);
      if (selected.has(key)) return mix(shade(box), tint, SELECTED_MIX);
      if (key === hovered) return mix(shade(box), tint, HOVER_MIX);
      return shade(box);
    };
  };

/** `colorer`, with the pieces `faded` says faded towards the canvas (off the current level). */
export const withLevel: (
  colorer: PieceColorer,
  faded: (box: PieceBox) => boolean,
  tokens: ThemeTokens
) => PieceColorer = levelled(mixHex);

/**
 * `colorer`, with the level the Levels bar previews (`hovered`, if any) tinted towards
 * `tint` as a hovered piece is (the selection colour; neutral in the support view).
 */
export const withLevelHover: (
  colorer: PieceColorer,
  hovered: ((box: PieceBox) => boolean) | null,
  tint: string
) => PieceColorer = levelHovered(mixHex);

/**
 * `colorer`, with selected items and the hovered one tinted towards `tint` (the selection
 * colour; neutral in the support view, where pink would read as collapsing).
 */
export const withHighlight: (
  colorer: PieceColorer,
  selection: Selection,
  hover: Hit | null,
  tint: string
) => PieceColorer = highlighted(mixHex);

/**
 * How a textured model is shaded: its own colours mixed towards `color` by `amount`
 * (0 leaves the texture as it is), in sRGB, as `mixHex` mixes the boxes' colours.
 */
export interface Tint {
  color: string;
  amount: number;
}

export type PieceTinter = (box: PieceBox) => Tint;

export const NO_TINT: Tint = { color: '#ffffff', amount: 0 };

/**
 * How much of a support band's colour goes over the texture (mixed in sRGB, like the
 * other tints): enough to read the band, with the texture still showing.
 */
const SUPPORT_TINT = 0.7;

/**
 * A tint mixed once more: mixing the texture by `amount` towards `color`, then by
 * `share` towards `hex`, is one mix by `1 − (1 − amount)(1 − share)`.
 */
export const mixTint: Mixer<Tint> = ({ color, amount }, hex, share) => {
  const total = 1 - (1 - amount) * (1 - share);
  return total === 0 ? NO_TINT : { color: mixHex(color, hex, share / total), amount: total };
};

/** Models as they are: no tint. */
export const plainTinter: PieceTinter = () => NO_TINT;

/** Models in their support band's colour; pieces that take no part keep their texture. */
export const supportTinter =
  (support: PlanSupport | null, tokens: ThemeTokens): PieceTinter =>
  (box) => {
    const color = supportBandColor(tokens, bandOf(support, box.key));
    return color ? { color, amount: SUPPORT_TINT } : NO_TINT;
  };

/** `withLevel` for model tints. */
export const tintWithLevel = levelled(mixTint);
/** `withLevelHover` for model tints. */
export const tintWithLevelHover = levelHovered(mixTint);
/** `withHighlight` for model tints. */
export const tintWithHighlight = highlighted(mixTint);
