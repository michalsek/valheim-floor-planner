import { useAtomValue } from 'jotai';
import { useCallback, useRef, useSyncExternalStore } from 'react';

import { derivePlan, type Derived } from '../model/derivePlan';
import { ghostPlan, levelPlan } from '../model/levels';
import { pieceBoxes, type PieceBox } from '../model/pieceBoxes';
import type { Plan } from '../model/types';

import { applyCommands, type PlanCommand } from '../model/commands';
import { getLibrary } from './libraryInstance';
import { planStore } from './planInstance';
import type { HistoryLabels } from './planStore';
import { editPreviewAtom } from './selection';
import { workDatumAtom } from './session';

const subscribe = (onChange: () => void) => planStore.subscribe(onChange);

/**
 * Selects a slice of the plan and re-renders only when it changes (`Object.is` by
 * default; pass `isEqual` for structural slices). Adapted from yummies
 * `useDocumentSelector`.
 */
export const usePlanSelector = <T>(
  selector: (plan: Plan) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T => {
  // Caches the last value so `getSnapshot` is stable across unrelated changes.
  const cache = useRef<{ value: T } | null>(null);
  const getSnapshot = useCallback(() => {
    const next = selector(planStore.getPlan());
    if (cache.current && isEqual(cache.current.value, next)) return cache.current.value;
    cache.current = { value: next };
    return next;
  }, [selector, isEqual]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export const usePlan = (): Plan => useSyncExternalStore(subscribe, planStore.getPlan);

export interface UndoRedoState {
  undo(): boolean;
  redo(): boolean;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
}

/** Undo/redo bound to the plan store, with live availability and labels. */
export const useUndoRedo = (): UndoRedoState => {
  const undoLabel = useSyncExternalStore(subscribe, planStore.peekUndoLabel);
  const redoLabel = useSyncExternalStore(subscribe, planStore.peekRedoLabel);
  return {
    undo: planStore.undo,
    redo: planStore.redo,
    canUndo: undoLabel !== null,
    canRedo: redoLabel !== null,
    undoLabel,
    redoLabel,
  };
};

const derivedCache = new WeakMap<Plan, Derived>();

/** Pieces, bill of materials and warnings for a plan (memoised per plan object). */
export const getDerived = (plan: Plan): Derived => {
  let derived = derivedCache.get(plan);
  if (!derived) {
    derived = derivePlan(plan, getLibrary());
    derivedCache.set(plan, derived);
  }
  return derived;
};

const boxesCache = new WeakMap<Plan, PieceBox[]>();

/**
 * The plan's pieces and props as 3D boxes, each at its own elevation (not the work
 * datum). Memoised per plan object.
 */
export const getPieceBoxes = (plan: Plan): PieceBox[] => {
  let boxes = boxesCache.get(plan);
  if (!boxes) {
    boxes = pieceBoxes(getDerived(plan), plan, getLibrary());
    boxesCache.set(plan, boxes);
  }
  return boxes;
};

const roofless = new WeakMap<readonly PieceBox[], readonly PieceBox[]>();

/**
 * The plan's boxes the 3D view shows (and Pick hits) before the cut-away: without roof
 * covers (derived or imported) while roofs are hidden; gable fills and filler courses stay.
 */
export const getShownBoxes = (plan: Plan, roofsVisible: boolean): readonly PieceBox[] => {
  const all = getPieceBoxes(plan);
  if (roofsVisible) return all;
  let shown = roofless.get(all);
  if (!shown) roofless.set(all, (shown = all.filter((b) => !b.roofCover)));
  return shown;
};

/** History labels for the history list (see `PlanStore.historyLabels`). */
export const useHistory = (): HistoryLabels =>
  useSyncExternalStore(subscribe, planStore.historyLabels);

// One shared entry, so every component drawing the same preview frame gets the same
// plan object (and `getDerived` splits it once).
let lastDisplay: { plan: Plan; preview: readonly PlanCommand[] | null; result: Plan } | null = null;

/** `plan` with an in-progress edit applied; the committed plan if the edit no longer applies. */
const getDisplayPlan = (plan: Plan, preview: readonly PlanCommand[] | null): Plan => {
  if (!preview) return plan;
  if (lastDisplay?.plan === plan && lastDisplay.preview === preview) return lastDisplay.result;
  let result = plan;
  try {
    result = applyCommands(plan, preview);
  } catch (error) {
    // E.g. a file opened mid-drag removed the dragged wall.
    console.warn('Edit preview no longer applies.', error);
  }
  lastDisplay = { plan, preview, result };
  return result;
};

/** The plan as the canvas draws it: committed, plus the move or corner drag in progress. */
export const useDisplayPlan = (): Plan => getDisplayPlan(usePlan(), useAtomValue(editPreviewAtom));

/** Derived data for `useDisplayPlan` (the BOM panel keeps the committed plan's). */
export const useDisplayDerived = (): Derived => getDerived(useDisplayPlan());

/** The displayed plan as the current level (the work datum) sees it: what 2D draws. */
export const useLevelPlan = (): Plan =>
  levelPlan(useDisplayPlan(), useAtomValue(workDatumAtom), getLibrary());

export const useLevelDerived = (): Derived => getDerived(useLevelPlan());

/** What the current level shows faintly from below (2D). */
export const useGhostPlan = (): Plan =>
  ghostPlan(useDisplayPlan(), useAtomValue(workDatumAtom), getLibrary());
