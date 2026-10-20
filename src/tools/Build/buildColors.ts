/**
 * The Build ghost's colours (M17 §2.6), from the theme: each piece in its support band
 * (blue on the ground, green → red as support falls, magenta when it would collapse),
 * its material colour while support is being checked, red when placing is blocked. Its
 * edges are amber over a deep overlap (advisory). Models take the colour as a 45 % tint.
 */
import { useMemo } from 'react';

import type { PieceBox } from '../../model/pieceBoxes';
import {
  materialColorer,
  type PieceColorer,
  type PieceTinter,
} from '../../scene/view3d/pieceColors';
import { supportBand, supportBandColor } from '../../scene/supportColors';
import { useThemeTokens } from '../../store/hooks';
import type { ThemeTokens } from '../../theme/themeTokens';

import type { BuildGhost, BuildRemoval } from './buildGhost';

/** How far a ghost model's texture is tinted towards its state colour. */
export const GHOST_TINT = 0.45;

export interface GhostShades {
  colorOf: PieceColorer;
  tintOf: PieceTinter;
  /** The edges' and snap dots' colour. */
  edge: string;
}

/** The overlay's amber (`--warning`), which the scene tokens don't carry. */
const warningColor = (tokens: ThemeTokens): string => {
  const value =
    typeof document === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement).getPropertyValue('--warning').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : tokens.support.mid;
};

const ghostColors = (ghost: BuildGhost, tokens: ThemeTokens): Map<string, string> => {
  const plain = materialColorer(tokens);
  return new Map(
    ghost.boxes.map((box, i) => {
      if (ghost.blockedBy) return [box.key, tokens.ink.danger];
      const support = ghost.support?.[i];
      const band = support ? supportBandColor(tokens, supportBand(support)) : null;
      return [box.key, band ?? plain(box)];
    })
  );
};

const shadesOf = (colors: ReadonlyMap<string, string>, fallback: string, edge: string) => {
  const colorOf = (box: PieceBox) => colors.get(box.key) ?? fallback;
  return {
    colorOf,
    tintOf: (box: PieceBox) => ({ color: colorOf(box), amount: GHOST_TINT }),
    edge,
  };
};

/** The ghost's shades (null without a ghost); they follow the theme. */
export const useGhostShades = (ghost: BuildGhost | null): GhostShades | null => {
  const tokens = useThemeTokens();
  const warning = useMemo(() => warningColor(tokens), [tokens]);
  return useMemo(() => {
    if (!ghost) return null;
    const colors = ghostColors(ghost, tokens);
    const first = colors.values().next().value ?? tokens.ink.accent;
    const edge = ghost.blockedBy ? tokens.ink.danger : ghost.overlap ? warning : first;
    return shadesOf(colors, first, edge);
  }, [ghost, tokens, warning]);
};

/** The piece Ctrl/⌘ + click would remove, in red. */
export const useRemovalShades = (removal: BuildRemoval | null): GhostShades | null => {
  const tokens = useThemeTokens();
  return useMemo(
    () => removal && shadesOf(new Map(), tokens.ink.danger, tokens.ink.danger),
    [removal, tokens]
  );
};
