/**
 * What the Build tool builds against (M17 §3.1, §3.4): the committed plan's pieces as
 * the views draw them (below the cut, roofs as toggled), with their snap index, and the
 * shown terrain. Hidden pieces are neither hit nor snapped to. The lists are kept per
 * committed plan and cut, so the snap index (cached per list) is built once per commit.
 */
import { atom, type Getter } from 'jotai';

import { snapIndex, type SnapIndex } from '../../model/build/snapPoints';
import type { PieceBox } from '../../model/pieceBoxes';
import type { SiteFrame, TerrainGrid } from '../../model/terrain/siteTerrain';
import type { Plan } from '../../model/types';
import { committedPlanAtom } from '../../store/committedPlan';
import { getLibrary } from '../../store/libraryInstance';
import { surfaceScene } from '../../store/pointer';
import { getPieceBoxes } from '../../store/planHooks';

export interface BuildTargets {
  plan: Plan;
  /** What the ray lands on and what snaps. */
  boxes: readonly PieceBox[];
  index: SnapIndex;
  /** The terrain the ray lands on while it is shown; null otherwise (the plane 0). */
  terrain: { grid: TerrainGrid; frame: SiteFrame } | null;
  /** Some pieces of the plan are hidden (by the cut or the Roofs toggle). */
  hidden: boolean;
}

/** The last list kept without the carried pieces (a pointer sweep asks the same). */
let lastKept: {
  shown: readonly PieceBox[];
  exclude: ReadonlySet<string>;
  boxes: readonly PieceBox[];
} | null = null;

const without = (shown: readonly PieceBox[], exclude: ReadonlySet<string>) => {
  if (lastKept?.shown !== shown || lastKept.exclude !== exclude) {
    lastKept = { shown, exclude, boxes: shown.filter((b) => !exclude.has(b.key)) };
  }
  return lastKept.boxes;
};

/**
 * The Build targets for the current view and cut of `plan`, less the boxes whose keys
 * are in `exclude` (the pieces being carried: they are neither hit nor snapped to).
 */
export const buildTargets = (
  get: Getter,
  plan: Plan,
  exclude: ReadonlySet<string> | null = null
): BuildTargets => {
  // The drawn boxes are the same array per plan, cut and Roofs toggle (`cutBoxes`).
  const { boxes: shown, terrain } = surfaceScene(get, plan);
  const boxes = exclude ? without(shown, exclude) : shown;
  return {
    plan,
    boxes,
    index: snapIndex(boxes, getLibrary()),
    terrain,
    hidden: shown.length < getPieceBoxes(plan).length,
  };
};

/** The Build tool's targets for the current view and cut. */
export const buildTargetsAtom = atom<BuildTargets>((get) =>
  buildTargets(get, get(committedPlanAtom))
);
