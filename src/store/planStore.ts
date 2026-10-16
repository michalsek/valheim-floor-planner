/**
 * The plan document store: Immer patches, labelled undo/redo, and `transact` for
 * one-gesture-one-entry changes. Adapted from yummies `core/store/documentStore`.
 */
import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';

import type { Plan } from '../model/types';

import { applyCommand, COMMAND_LABELS, PlanCommandError, type PlanCommand } from './commands';

enablePatches();

export type PlanChangeSource = 'dispatch' | 'transaction' | 'undo' | 'redo' | 'load';

export interface PlanChange {
  plan: Plan;
  source: PlanChangeSource;
  label: string;
}

export type DispatchResult = { ok: true } | { ok: false; error: PlanCommandError };

export interface PlanStore {
  getPlan(): Plan;
  /** Labelled "Undo <label>"; defaults to the command's `COMMAND_LABELS` entry. */
  dispatch(cmd: PlanCommand, options?: { label?: string }): DispatchResult;
  /** Applies several commands as one atomic, single-history-entry change. */
  transact(label: string, run: (dispatch: (cmd: PlanCommand) => void) => void): DispatchResult;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  peekUndoLabel(): string | null;
  peekRedoLabel(): string | null;
  /** Replaces the plan and clears history (start-up only). */
  load(plan: Plan): void;
  subscribe(listener: (change: PlanChange) => void): () => void;
}

interface HistoryEntry {
  label: string;
  patches: Patch[];
  inversePatches: Patch[];
}

const toError = (error: unknown): PlanCommandError => {
  if (error instanceof PlanCommandError) return error;
  throw error;
};

const produceStep = (base: Plan, cmd: PlanCommand): readonly [Plan, Patch[], Patch[]] =>
  produceWithPatches(base, (draft) => applyCommand(draft, cmd));

export const createPlanStore = (
  initial: Plan,
  options: { historyLimit?: number } = {}
): PlanStore => {
  const historyLimit = options.historyLimit ?? 500;
  let plan = initial;
  let undoStack: HistoryEntry[] = [];
  let redoStack: HistoryEntry[] = [];
  const listeners = new Set<(change: PlanChange) => void>();

  const notify = (source: PlanChangeSource, label: string): void => {
    for (const listener of listeners) listener({ plan, source, label });
  };

  const commit = (next: Plan, entry: HistoryEntry, source: PlanChangeSource): DispatchResult => {
    // A change with no effect is not an edit.
    if (entry.patches.length === 0) return { ok: true };
    plan = next;
    undoStack.push(entry);
    if (undoStack.length > historyLimit) undoStack = undoStack.slice(-historyLimit);
    redoStack = [];
    notify(source, entry.label);
    return { ok: true };
  };

  const step = (from: HistoryEntry[], to: HistoryEntry[], source: 'undo' | 'redo'): boolean => {
    const entry = from.pop();
    if (!entry) return false;
    plan = applyPatches(plan, source === 'undo' ? entry.inversePatches : entry.patches);
    to.push(entry);
    notify(source, entry.label);
    return true;
  };

  return {
    getPlan: () => plan,

    dispatch(cmd, dispatchOptions) {
      try {
        const [next, patches, inversePatches] = produceStep(plan, cmd);
        const label = dispatchOptions?.label ?? COMMAND_LABELS[cmd.type];
        return commit(next, { label, patches, inversePatches }, 'dispatch');
      } catch (error) {
        return { ok: false, error: toError(error) };
      }
    },

    transact(label, run) {
      let current = plan;
      const patches: Patch[] = [];
      const inverse: Patch[][] = [];
      try {
        run((cmd) => {
          const [next, stepPatches, stepInverse] = produceStep(current, cmd);
          current = next;
          patches.push(...stepPatches);
          inverse.unshift(stepInverse);
        });
      } catch (error) {
        return { ok: false, error: toError(error) };
      }
      return commit(current, { label, patches, inversePatches: inverse.flat() }, 'transaction');
    },

    undo: () => step(undoStack, redoStack, 'undo'),
    redo: () => step(redoStack, undoStack, 'redo'),
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    peekUndoLabel: () => undoStack[undoStack.length - 1]?.label ?? null,
    peekRedoLabel: () => redoStack[redoStack.length - 1]?.label ?? null,

    load(next) {
      plan = next;
      undoStack = [];
      redoStack = [];
      notify('load', 'Load');
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
