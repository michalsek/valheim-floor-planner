/**
 * Importing a world build: its pieces as a new plan (an undoable `plan.replace`), on its
 * main floor (`ImportedBuild.level`), fitted in view.
 */
import type { WorldPieces } from '../gameData/valheim/world/worldPieces';
import { clampElevation, roundElevation } from '../model/elevation';
import { planBounds } from '../model/planBounds';
import { isPlanEmpty } from '../model/selection';
import type { WorldCluster } from '../model/world/clusters';
import { importCluster } from '../model/world/importCluster';

import { getLibrary } from './libraryInstance';
import type { PlanStore } from './planStore';
import { hoverAtom, selectionAtom } from './selection';
import { fitViewTo, workDatumAtom, type SessionAccess } from './session';
import { resetOrbit } from './view3d';

type ImportContext = SessionAccess & { plan: PlanStore };

/**
 * Replaces the plan with the build (asking first unless the plan is empty): 'done',
 * 'kept' when the user said no, or why it can't be imported.
 */
export const importBuild = (
  ctx: ImportContext,
  world: { name: string; pieces: WorldPieces },
  cluster: WorldCluster
): 'done' | 'kept' | { error: string } => {
  if (
    !isPlanEmpty(ctx.plan.getPlan()) &&
    !window.confirm('Replace the current plan with this build? You can undo this.')
  ) {
    return 'kept';
  }
  let imported;
  try {
    imported = importCluster(world.pieces, cluster, getLibrary(), world.name);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  const { plan, level } = imported;
  ctx.plan.dispatch({ type: 'plan.replace', plan }, { label: `Import from ${world.name}` });
  ctx.set(selectionAtom, []);
  ctx.set(hoverAtom, null);
  ctx.set(workDatumAtom, roundElevation(clampElevation(level)));
  fitViewTo(ctx, planBounds(plan, getLibrary()));
  resetOrbit(ctx);
  return 'done';
};
