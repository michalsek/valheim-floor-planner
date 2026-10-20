/**
 * New, Open and Save, shared by the plan header and the Mod+O / Mod+S keys. Open and
 * New replace the plan with an undoable `plan.replace` and show it whole (the cut at
 * All); outcomes go to `fileStatusAtom`.
 */
import { atom } from 'jotai';

import { planBounds } from '../model/planBounds';
import { isPlanEmpty } from '../model/selection';
import type { LegacyItems } from '../model/serialize';
import { DEFAULT_PLAN_NAME, emptyPlan } from '../model/types';

import { pickPlanFile, readPlanFile, savePlanFile } from './files';
import { getImage, putImage } from './imageStore';
import { getLibrary } from './libraryInstance';
import type { PlanStore } from './planStore';
import { embedUnderlayAtom, fitViewTo, resetCut, type SessionAccess } from './session';
import { resetOrbit } from './view3d';

export interface FileStatus {
  tone: 'error' | 'info';
  message: string;
}

/** The last file action's outcome, until dismissed or replaced. */
export const fileStatusAtom = atom<FileStatus | null>(null);

const NOUNS: readonly [keyof LegacyItems, string][] = [
  ['walls', 'wall'],
  ['floors', 'floor'],
  ['doors', 'door'],
  ['roofs', 'roof'],
];

/** "1 wall", "2 walls, 1 floor and 1 roof": the nonzero counts. */
const listItems = (legacy: LegacyItems): string => {
  const parts = NOUNS.flatMap(([key, noun]) => {
    const n = legacy[key];
    return n > 0 ? [`${n} ${noun}${n === 1 ? '' : 's'}`] : [];
  });
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts.join('');
};

/** What the autosave did with a record with drawn items (`OpenedStorage.keptAside`). */
const ASIDE = {
  kept: ' The plan as it was is kept aside in this browser.',
  lost: " The plan as it was couldn't be kept aside in this browser: open it in an earlier version before editing.",
};

/**
 * What loading a plan with drawn items says: they were left out, and how to keep them;
 * for the autosave (`keptAside` given), whether the record as it was is kept aside. A
 * partial success, so in the error tone (as a save without its image is).
 */
export const legacyNotice = (legacy: LegacyItems, keptAside?: boolean): FileStatus => {
  const one = Object.values(legacy).reduce((n, count) => n + count, 0) === 1;
  const [they, were, them] = one ? ['it', 'was', 'it'] : ['they', 'were', 'them'];
  return {
    tone: 'error',
    message:
      `Left out ${listItems(legacy)}: ${they} ${were} drawn with tools this version no longer has. ` +
      `To keep ${them} as single pieces, open the plan in an earlier version and Explode ${them} first.` +
      (keptAside === undefined ? '' : keptAside ? ASIDE.kept : ASIDE.lost),
  };
};

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
    const { plan, underlayImage, legacy } = await readPlanFile(file);
    // Stored first, so the underlay doesn't flash "missing".
    if (plan.underlay && underlayImage) await putImage(plan.underlay.imageId, underlayImage);
    ctx.plan.dispatch({ type: 'plan.replace', plan }, { label: `Open ${file.name}` });
    resetCut(ctx);
    fitViewTo(ctx, planBounds(plan, getLibrary()));
    resetOrbit(ctx);
    ctx.set(fileStatusAtom, legacy ? legacyNotice(legacy) : null);
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
    if (current.name === DEFAULT_PLAN_NAME) {
      resetCut(ctx);
      return;
    }
  } else if (!window.confirm('Start a new plan? You can undo this.')) {
    return;
  }
  ctx.plan.dispatch({ type: 'plan.replace', plan: emptyPlan() }, { label: 'New plan' });
  resetCut(ctx);
  resetOrbit(ctx);
  ctx.set(fileStatusAtom, null);
};
