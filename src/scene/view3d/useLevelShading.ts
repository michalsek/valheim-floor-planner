/**
 * Which boxes the 3D view draws and how it shades them by level: hidden roofs left
 * out, the cut-away above the current level, pieces faded off it, the level the
 * Levels bar previews tinted, and the selection and hover over that.
 */
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { isLevelConnector } from '../../catalog/propDefs';
import { sameLevel } from '../../model/elevation';
import type { Bounds3 } from '../../model/geometry/bounds3';
import { cutAway, levelIndex } from '../../model/levels';
import { boxesBounds, type PieceBox } from '../../model/pieceBoxes';
import type { Plan } from '../../model/types';
import { useThemeTokens } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { getShownBoxes } from '../../store/planHooks';
import { hoverAtom, selectionAtom } from '../../store/selection';
import {
  cutAwayAtom,
  levelHoverAtom,
  roofsVisibleAtom,
  supportViewAtom,
  workDatumAtom,
} from '../../store/session';
import { useSupport } from '../../store/supportSync';

import {
  materialColorer,
  plainTinter,
  supportColorer,
  supportTinter,
  tintWithHighlight,
  tintWithLevel,
  tintWithLevelHover,
  withHighlight,
  withLevel,
  withLevelHover,
  type PieceColorer,
  type PieceTinter,
} from './pieceColors';

export interface LevelShading {
  /** What is drawn: the shown boxes after the cut. */
  boxes: readonly PieceBox[];
  /** Every shown box, cut or not: the models to keep loaded. */
  retainBoxes: readonly PieceBox[];
  /** The bounds of `retainBoxes`, so the camera and shadows don't move with the level. */
  bounds: Bounds3 | null;
  colorOf: PieceColorer;
  tintOf: PieceTinter;
}

/** The level hovered in the Levels bar, unless it is the current one. */
export const usePreviewLevel = (): number | null => {
  const datum = useAtomValue(workDatumAtom);
  const hovered = useAtomValue(levelHoverAtom);
  return hovered === null || sameLevel(hovered, datum) ? null : hovered;
};

const boundsCache = new WeakMap<readonly PieceBox[], Bounds3 | null>();

const boundsOf = (boxes: readonly PieceBox[]): Bounds3 | null => {
  let bounds = boundsCache.get(boxes);
  if (bounds === undefined) boundsCache.set(boxes, (bounds = boxesBounds(boxes)));
  return bounds;
};

/**
 * `plan`'s boxes the 3D view shows before the cut (`getShownBoxes`), and their bounds:
 * what the camera, the shadows and the level plate fit.
 */
export const useShownBoxes = (
  plan: Plan
): { boxes: readonly PieceBox[]; bounds: Bounds3 | null } => {
  const boxes = getShownBoxes(plan, useAtomValue(roofsVisibleAtom));
  return { boxes, bounds: boundsOf(boxes) };
};

/** Each box's level (a stair piece's is its flight's). */
const useLevelOf = (plan: Plan): ((box: PieceBox) => number) =>
  useMemo(() => {
    const { levelOf } = levelIndex(plan, getLibrary());
    return (box) => levelOf(box.elevation, isLevelConnector(box.group));
  }, [plan]);

/** `plan`'s boxes as the 3D view draws and shades them. */
export const useLevelShading = (plan: Plan): LevelShading => {
  const datum = useAtomValue(workDatumAtom);
  const cut = useAtomValue(cutAwayAtom);
  const preview = usePreviewLevel();
  const tokens = useThemeTokens();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const supportView = useAtomValue(supportViewAtom);
  const { support } = useSupport();
  const levelOf = useLevelOf(plan);

  const { boxes: retainBoxes, bounds } = useShownBoxes(plan);
  const boxes = useMemo(
    () =>
      cut ? cutAway(retainBoxes, plan, getLibrary(), { datum, hovered: preview }) : retainBoxes,
    [cut, retainBoxes, plan, datum, preview]
  );

  // Above the level is faded (shown with the cut off); below it too while there is no
  // plate (at datum 0), else the plate's frosting fades it. The previewed level isn't.
  const faded = useMemo(() => {
    const plate = datum !== 0;
    return (box: PieceBox) => {
      const level = levelOf(box);
      if (sameLevel(level, datum) || (preview !== null && sameLevel(level, preview))) {
        return false;
      }
      return level > datum || !plate;
    };
  }, [levelOf, datum, preview]);
  const previewed = useMemo(
    () => (preview === null ? null : (box: PieceBox) => sameLevel(levelOf(box), preview)),
    [levelOf, preview]
  );

  const highlight = supportView ? tokens.ink.neutral : tokens.selection;
  const colorOf = useMemo(() => {
    const plain = materialColorer(tokens);
    const base = supportView ? supportColorer(support, tokens, plain) : plain;
    const levelled = withLevelHover(withLevel(base, faded, tokens), previewed, highlight);
    return withHighlight(levelled, selection, hover, highlight);
  }, [tokens, supportView, support, faded, previewed, selection, hover, highlight]);
  const tintOf = useMemo(() => {
    const base = supportView ? supportTinter(support, tokens) : plainTinter;
    const levelled = tintWithLevelHover(tintWithLevel(base, faded, tokens), previewed, highlight);
    return tintWithHighlight(levelled, selection, hover, highlight);
  }, [tokens, supportView, support, faded, previewed, selection, hover, highlight]);

  return { boxes, retainBoxes, bounds, colorOf, tintOf };
};
