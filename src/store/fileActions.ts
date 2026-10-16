/**
 * New, Open and Save, shared by the plan header and the Mod+O / Mod+S keys. Open and
 * New replace the plan with an undoable `plan.replace`; outcomes go to `fileStatusAtom`.
 */
import { atom } from 'jotai';

import { planBounds } from '../model/planBounds';
import { isPlanEmpty } from '../model/selection';
import { DEFAULT_PLAN_NAME, emptyPlan } from '../model/types';

import { pickPlanFile, readPlanFile, savePlanFile } from './files';
import { getImage, putImage } from './imageStore';
import { getLibrary } from './libraryInstance';
import type { PlanStore } from './planStore';
import { embedUnderlayAtom, fitViewTo, type SessionAccess } from './session';
import { resetOrbit } from './view3d';

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
    const plan = ctx.plan.getPlan();
    const imageId = ctx.get(embedUnderlayAtom) ? plan.underlay?.imageId : undefined;
    const result = await savePlanFile(
      plan,
      imageId ? { underlayImage: () => getImage(imageId) } : {}
    );
    if (result) {
      const verb = result.via === 'picker' ? 'Saved' : 'Downloaded';
      ctx.set(
        fileStatusAtom,
        result.imageSkipped
          ? {
              tone: 'error',
              message: `${verb} ${result.fileName} without the underlay image: it is too big to embed.`,
            }
          : { tone: 'info', message: `${verb} ${result.fileName}` }
      );
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
    const { plan, underlayImage } = await readPlanFile(file);
    // Stored first, so the underlay doesn't flash "missing".
    if (plan.underlay && underlayImage) await putImage(plan.underlay.imageId, underlayImage);
    ctx.plan.dispatch({ type: 'plan.replace', plan }, { label: `Open ${file.name}` });
    fitViewTo(ctx, planBounds(plan, getLibrary()));
    resetOrbit(ctx);
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
  resetOrbit(ctx);
  ctx.set(fileStatusAtom, null);
};
