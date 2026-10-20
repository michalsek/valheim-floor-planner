/**
 * Which boxes the 3D view draws and how it shades them (interim; pass 3 replaces it with
 * cut shading): hidden roofs left out, the cut (`cutBoxes`), or with ghosts on everything
 * with the pieces above the cut faded, and the selection and hover over that.
 */
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { aboveCut, cutBoxes } from '../../model/cut';
import type { Bounds3 } from '../../model/geometry/bounds3';
import { boxesBounds, type PieceBox } from '../../model/pieceBoxes';
import type { Plan } from '../../model/types';
import { useThemeTokens } from '../../store/hooks';
import { getShownBoxes } from '../../store/planHooks';
import { useShownSiteTerrain } from '../../store/siteTerrain';
import { hoverAtom, selectionAtom } from '../../store/selection';
import {
  cutGhostAtom,
  cutHeightAtom,
  roofsVisibleAtom,
  supportViewAtom,
  workPlaneAtom,
} from '../../store/session';
import { useSupport } from '../../store/supportSync';

import {
  materialColorer,
  plainTinter,
  supportColorer,
  supportTinter,
  tintWithHighlight,
  tintWithLevel,
  withHighlight,
  withLevel,
  type PieceColorer,
  type PieceTinter,
} from './pieceColors';

export interface LevelShading {
  /** What is drawn: the shown boxes below the cut (all of them with ghosts on). */
  boxes: readonly PieceBox[];
  /** Every shown box, cut or not: the models to keep loaded. */
  retainBoxes: readonly PieceBox[];
  /** The bounds of `retainBoxes`, so the camera and shadows don't move with the cut. */
  bounds: Bounds3 | null;
  colorOf: PieceColorer;
  tintOf: PieceTinter;
}

/**
 * Whether the level plate is drawn: off the ground, and at every height (0 included)
 * over shown terrain, where the ground is no longer the work plane.
 */
export const usePlateShown = (): boolean => {
  const plane = useAtomValue(workPlaneAtom);
  const site = useShownSiteTerrain();
  return plane !== 0 || site !== null;
};

const boundsCache = new WeakMap<readonly PieceBox[], Bounds3 | null>();

const boundsOf = (boxes: readonly PieceBox[]): Bounds3 | null => {
  let bounds = boundsCache.get(boxes);
  if (bounds === undefined) boundsCache.set(boxes, (bounds = boxesBounds(boxes)));
  return bounds;
};

/**
 * `plan`'s boxes the 3D view can show, before the cut (`getShownBoxes`), and their
 * bounds: what the camera, the shadows and the level plate fit.
 */
export const useShownBoxes = (
  plan: Plan
): { boxes: readonly PieceBox[]; bounds: Bounds3 | null } => {
  const boxes = getShownBoxes(plan, useAtomValue(roofsVisibleAtom));
  return { boxes, bounds: boundsOf(boxes) };
};

const NONE: readonly PieceBox[] = [];
const NOT_FADED = () => false;
const fadedCache = new WeakMap<readonly PieceBox[], (box: PieceBox) => boolean>();

/** Whether a box is one of `above` (the ghosts); kept per list, so memos downstream hold. */
const fadedBy = (above: readonly PieceBox[]): ((box: PieceBox) => boolean) => {
  if (above.length === 0) return NOT_FADED;
  let faded = fadedCache.get(above);
  if (!faded) {
    const keys = new Set(above.map((box) => box.key));
    fadedCache.set(above, (faded = (box) => keys.has(box.key)));
  }
  return faded;
};

/** `plan`'s boxes as the 3D view draws and shades them. */
export const useLevelShading = (plan: Plan): LevelShading => {
  const h = useAtomValue(cutHeightAtom);
  const ghosts = useAtomValue(cutGhostAtom);
  const tokens = useThemeTokens();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const supportView = useAtomValue(supportViewAtom);
  const { support } = useSupport();

  const { boxes: retainBoxes, bounds } = useShownBoxes(plan);
  const boxes = ghosts ? retainBoxes : cutBoxes(retainBoxes, h);

  // With ghosts on, what the cut hides is drawn faded (and never picked: tools see
  // `cutBoxes` only).
  const faded = fadedBy(ghosts ? aboveCut(retainBoxes, h) : NONE);

  const highlight = supportView ? tokens.ink.neutral : tokens.selection;
  const colorOf = useMemo(() => {
    const plain = materialColorer(tokens);
    const base = supportView ? supportColorer(support, tokens, plain) : plain;
    return withHighlight(withLevel(base, faded, tokens), selection, hover, highlight);
  }, [tokens, supportView, support, faded, selection, hover, highlight]);
  const tintOf = useMemo(() => {
    const base = supportView ? supportTinter(support, tokens) : plainTinter;
    return tintWithHighlight(tintWithLevel(base, faded, tokens), selection, hover, highlight);
  }, [tokens, supportView, support, faded, selection, hover, highlight]);

  return { boxes, retainBoxes, bounds, colorOf, tintOf };
};
