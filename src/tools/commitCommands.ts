/** Committing an edit from any tool or panel. */
import type { PlanCommand } from '../model/commands';

import { revealPlaced } from './cutActions';
import type { ToolContext } from './types';

/**
 * Commits `cmds` as one history entry, the cut rising to show what they placed or moved
 * (`revealPlaced`); true when it worked (or there was nothing to do).
 */
export const commitCommands = (
  ctx: ToolContext,
  label: string,
  cmds: readonly PlanCommand[]
): boolean => {
  if (cmds.length === 0) return true;
  const result = ctx.plan.transact(label, (dispatch) => cmds.forEach(dispatch));
  if (!result.ok) console.warn(`${label} failed.`, result.error);
  else revealPlaced(ctx, cmds);
  return result.ok;
};
