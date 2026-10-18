/**
 * What the Build tool builds against (M17 §3.1, §3.4): the committed plan's pieces as
 * the view shows them, with their snap index. In 3D, the drawn boxes (the level view
 * mode's levels, roofs as toggled) and the shown ground; in 2D, the current level and
 * the level below (what 2D draws), on the work plane only. Hidden pieces are neither hit
 * nor snapped to. The lists are kept per committed plan and view, so the snap index
 * (cached per list) is built once per commit.
 */
import { atom, type Getter } from 'jotai';

import { snapIndex, type SnapIndex } from '../../model/build/snapPoints';
import { ghostPlan, levelPlan } from '../../model/levels';
import type { PieceBox } from '../../model/pieceBoxes';
import type { SiteFrame, TerrainGrid } from '../../model/terrain/siteTerrain';
import type { Plan } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { getPieceBoxes, getShownBoxes } from '../../store/planHooks';
import { planStore } from '../../store/planInstance';
import {
  levelHoverAtom,
  levelViewModeAtom,
  roofsVisibleAtom,
  terrainShownAtom,
  workDatumAtom,
} from '../../store/session';
import { getSiteGround } from '../../store/siteTerrain';
import { viewModeAtom } from '../../store/view3d';
import { drawnBoxes } from '../picking';

const planBase = atom<Plan>(planStore.getPlan());
planBase.onMount = (set) => {
  set(planStore.getPlan());
  return planStore.subscribe(({ plan }) => set(plan));
};

/**
 * The committed plan, as an atom (followed while something reads it from React), so the
 * ghost follows a commit, an undo or a load at once.
 */
export const committedPlanAtom = atom((get) => get(planBase));

export interface BuildTargets {
  plan: Plan;
  /** What the ray lands on (3D) and what snaps. */
  boxes: readonly PieceBox[];
  index: SnapIndex;
  /** The ground the ray lands on: 3D with the terrain shown; null otherwise. */
  terrain: { grid: TerrainGrid; frame: SiteFrame } | null;
  /** Some pieces of the plan are hidden (by the level view mode or the Roofs toggle). */
  hidden: boolean;
}

/** One cached list per key: the last one asked for (a pointer sweep asks the same). */
const memoList = () => {
  let last: { key: readonly unknown[]; boxes: readonly PieceBox[] } | null = null;
  return (key: readonly unknown[], make: () => readonly PieceBox[]): readonly PieceBox[] => {
    if (last && last.key.length === key.length && last.key.every((k, i) => k === key[i])) {
      return last.boxes;
    }
    last = { key, boxes: make() };
    return last.boxes;
  };
};

const drawn = memoList();
const flat = memoList();

const targets3d = (get: Getter, plan: Plan): readonly PieceBox[] => {
  const shown = getShownBoxes(plan, get(roofsVisibleAtom));
  const key = [shown, get(levelViewModeAtom), get(workDatumAtom), get(levelHoverAtom)];
  return drawn(key, () => drawnBoxes({ get }, plan));
};

const targets2d = (get: Getter, plan: Plan): readonly PieceBox[] => {
  const datum = get(workDatumAtom);
  const level = getPieceBoxes(levelPlan(plan, datum, getLibrary()));
  const below = getPieceBoxes(ghostPlan(plan, datum, getLibrary()));
  return flat([level, below], () => [...level, ...below]);
};

const kept = memoList();

/**
 * The Build targets for the current view and level of `plan`, less the boxes whose keys
 * are in `exclude` (the pieces being carried: they are neither hit nor snapped to).
 */
export const buildTargets = (
  get: Getter,
  plan: Plan,
  exclude: ReadonlySet<string> | null = null
): BuildTargets => {
  const in3d = get(viewModeAtom) === '3d';
  const shown = in3d ? targets3d(get, plan) : targets2d(get, plan);
  const boxes = exclude
    ? kept([shown, exclude], () => shown.filter((b) => !exclude.has(b.key)))
    : shown;
  const site = in3d && get(terrainShownAtom) ? getSiteGround(plan) : null;
  return {
    plan,
    boxes,
    index: snapIndex(boxes, getLibrary()),
    terrain: site && { grid: site.grid, frame: site.frame },
    hidden: in3d && shown.length < getPieceBoxes(plan).length,
  };
};

/** The Build tool's targets for the current view and level. */
export const buildTargetsAtom = atom<BuildTargets>((get) =>
  buildTargets(get, get(committedPlanAtom))
);
