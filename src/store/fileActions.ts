/**
 * New, Open and Save, shared by the plan header and the Mod+O / Mod+S keys. Open and
 * New replace the plan with an undoable `plan.replace`; outcomes go to `fileStatusAtom`.
 */
import { atom } from 'jotai';

import { isPlanEmpty } from '../model/selection';
import { DEFAULT_PLAN_NAME, emptyPlan } from '../model/types';

import { pickPlanFile, readPlanFile, savePlanFile } from './files';
import type { PlanStore } from './planStore';
import type { SessionAccess } from './session';

interface FileStatus {
  tone: 'error' | 'info';
  message: string;
}

/** The last file action's outcome, until dismissed or replaced. */
export const fileStatusAtom = atom<FileStatus | null>(null);

type FileContext = SessionAccess & { plan: PlanStore };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Commits a field being edited (e.g. the plan name, which commits on blur) before a
 * file action reads the plan. The blur handler runs synchronously.
 */
const commitPendingEdit = (): void => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

// The pickers are async; a second Mod+S or Mod+O meanwhile must not open another.
let saving = false;
let opening = false;

export const saveCurrentPlan = async (ctx: FileContext): Promise<void> => {
  commitPendingEdit();
  if (saving) return;
  saving = true;
  try {
    const result = await savePlanFile(ctx.plan.getPlan());
    if (result) {
      const verb = result.via === 'picker' ? 'Saved' : 'Downloaded';
      ctx.set(fileStatusAtom, { tone: 'info', message: `${verb} ${result.fileName}` });
    }
  } catch (error) {
    ctx.set(fileStatusAtom, { tone: 'error', message: `Couldn't save: ${messageOf(error)}` });
  } finally {
    saving = false;
  }
};

export const openPlanFile = async (ctx: FileContext): Promise<void> => {
  commitPendingEdit();
  if (opening) return;
  opening = true;
  try {
    const file = await pickPlanFile();
    if (!file) return;
    const plan = await readPlanFile(file);
    ctx.plan.dispatch({ type: 'plan.replace', plan }, { label: `Open ${file.name}` });
    ctx.set(fileStatusAtom, null);
  } catch (error) {
    ctx.set(fileStatusAtom, { tone: 'error', message: messageOf(error) });
  } finally {
    opening = false;
  }
};

/** Starts an empty plan, asking first unless the current one is empty. */
export const startNewPlan = (ctx: FileContext): void => {
  commitPendingEdit();
  const current = ctx.plan.getPlan();
  if (isPlanEmpty(current)) {
    // Already new: nothing to replace, and no history entry.
    if (current.name === DEFAULT_PLAN_NAME) return;
  } else if (!window.confirm('Start a new plan? You can undo this.')) {
    return;
  }
  ctx.plan.dispatch({ type: 'plan.replace', plan: emptyPlan() }, { label: 'New plan' });
  ctx.set(fileStatusAtom, null);
};
