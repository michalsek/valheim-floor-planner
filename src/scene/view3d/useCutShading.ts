/**
 * Which boxes the 3D view draws and how it shades them: hidden roofs left out, the cut
 * (`cutBoxes`), with Ghost on what the cut hides as frosted ghosts (`CutGhosts`), and
 * the selection and hover over the drawn boxes.
 */
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { aboveCut, cutBoxes } from '../../model/cut';
import type { Bounds3 } from '../../model/geometry/bounds3';
import { boxesBounds, type PieceBox } from '../../model/pieceBoxes';
import type { Plan } from '../../model/types';
import { useThemeTokens } from '../../store/hooks';
import { getShownBoxes } from '../../store/planHooks';
import { hoverAtom, selectionAtom } from '../../store/selection';
import {
  cutGhostAtom,
  cutHeightAtom,
  roofsVisibleAtom,
  supportViewAtom,
} from '../../store/session';
import { useSupport } from '../../store/supportSync';

import {
  materialColorer,
  plainTinter,
  supportColorer,
  supportTinter,
  tintWithHighlight,
  withHighlight,
  type PieceColorer,
  type PieceTinter,
} from './pieceColors';

export interface CutShading {
  /** What is drawn solid: the shown boxes below the cut. */
  boxes: readonly PieceBox[];
  /** What the cut hides, drawn frosted with Ghost on (else none); never picked. */
  ghosts: readonly PieceBox[];
  /** Every shown box, cut or not: what the meshes and models are kept for. */
  retainBoxes: readonly PieceBox[];
  /** The bounds of `retainBoxes`, so the camera and shadows don't move with the cut. */
  bounds: Bounds3 | null;
  /** The bounds of `boxes`: what the cut outline goes around. */
  shownBounds: Bounds3 | null;
  colorOf: PieceColorer;
  tintOf: PieceTinter;
}

const boundsCache = new WeakMap<readonly PieceBox[], Bounds3 | null>();

const boundsOf = (boxes: readonly PieceBox[]): Bounds3 | null => {
  let bounds = boundsCache.get(boxes);
  if (bounds === undefined) boundsCache.set(boxes, (bounds = boxesBounds(boxes)));
  return bounds;
};

/**
 * `plan`'s boxes the 3D view can show, before the cut (`getShownBoxes`), and their
 * bounds: what the camera and the shadows fit.
 */
const useShownBoxes = (plan: Plan): { boxes: readonly PieceBox[]; bounds: Bounds3 | null } => {
  const boxes = getShownBoxes(plan, useAtomValue(roofsVisibleAtom));
  return { boxes, bounds: boundsOf(boxes) };
};

const NONE: readonly PieceBox[] = [];

/** `plan`'s boxes as the 3D view draws and shades them. */
export const useCutShading = (plan: Plan): CutShading => {
  const h = useAtomValue(cutHeightAtom);
  const ghost = useAtomValue(cutGhostAtom);
  const tokens = useThemeTokens();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const supportView = useAtomValue(supportViewAtom);
  const { support } = useSupport();

  const { boxes: retainBoxes, bounds } = useShownBoxes(plan);
  const boxes = cutBoxes(retainBoxes, h);
  const ghosts = ghost ? aboveCut(retainBoxes, h) : NONE;

  const highlight = supportView ? tokens.ink.neutral : tokens.selection;
  const colorOf = useMemo(() => {
    const plain = materialColorer(tokens);
    const base = supportView ? supportColorer(support, tokens, plain) : plain;
    return withHighlight(base, selection, hover, highlight);
  }, [tokens, supportView, support, selection, hover, highlight]);
  const tintOf = useMemo(() => {
    const base = supportView ? supportTinter(support, tokens) : plainTinter;
    return tintWithHighlight(base, selection, hover, highlight);
  }, [tokens, supportView, support, selection, hover, highlight]);

  return { boxes, ghosts, retainBoxes, bounds, shownBounds: boundsOf(boxes), colorOf, tintOf };
};
