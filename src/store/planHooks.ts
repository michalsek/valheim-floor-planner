import { useCallback, useRef, useSyncExternalStore } from 'react';

import { catalog, wallFamilyById } from '../catalog';
import { derivePlan, type Derived } from '../model/derivePlan';
import type { Plan } from '../model/types';

import { planStore } from './planInstance';

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
    derived = derivePlan(plan, wallFamilyById, catalog);
    derivedCache.set(plan, derived);
  }
  return derived;
};

export const useDerivedPlan = (): Derived => getDerived(usePlan());
