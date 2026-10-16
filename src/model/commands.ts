/** Plan edits. Every change to the plan document goes through one of these. */
import { produce } from 'immer';

import { samePoint } from './geometry/polyline';
import type { Dimension, DimId, Plan, WallId, WallRun } from './types';

export type PlanCommand =
  | { type: 'wall.insert'; wall: WallRun }
  | { type: 'wall.patch'; id: WallId; changes: Partial<Omit<WallRun, 'id'>> }
  | { type: 'wall.remove'; id: WallId }
  | { type: 'dimension.insert'; dimension: Dimension }
  | { type: 'dimension.patch'; id: DimId; changes: Partial<Omit<Dimension, 'id'>> }
  | { type: 'dimension.remove'; id: DimId }
  | { type: 'plan.rename'; name: string }
  | { type: 'plan.replace'; plan: Plan };

/** The history label a command gets unless the caller names the gesture. */
export const COMMAND_LABELS: Record<PlanCommand['type'], string> = {
  'wall.insert': 'Add wall',
  'wall.patch': 'Edit wall',
  'wall.remove': 'Delete wall',
  'dimension.insert': 'Add dimension',
  'dimension.patch': 'Edit dimension',
  'dimension.remove': 'Delete dimension',
  'plan.rename': 'Rename plan',
  'plan.replace': 'Replace plan',
};

export class PlanCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanCommandError';
  }
}

/**
 * Applies `cmd` to an Immer draft. `plan.replace` returns the new plan instead, which
 * Immer takes as the recipe's result.
 */
export const applyCommand = (draft: Plan, cmd: PlanCommand): Plan | undefined => {
  switch (cmd.type) {
    case 'wall.insert':
      if (cmd.wall.id in draft.walls) {
        throw new PlanCommandError(`Wall "${cmd.wall.id}" already exists`);
      }
      draft.walls[cmd.wall.id] = cmd.wall;
      return undefined;
    case 'wall.patch': {
      const wall = draft.walls[cmd.id];
      if (!wall) throw new PlanCommandError(`Wall "${cmd.id}" does not exist`);
      Object.assign(wall, cmd.changes);
      return undefined;
    }
    case 'wall.remove':
      if (!(cmd.id in draft.walls)) throw new PlanCommandError(`Wall "${cmd.id}" does not exist`);
      delete draft.walls[cmd.id];
      return undefined;
    case 'dimension.insert':
      if (cmd.dimension.id in draft.dimensions) {
        throw new PlanCommandError(`Dimension "${cmd.dimension.id}" already exists`);
      }
      if (samePoint(cmd.dimension.a, cmd.dimension.b)) {
        throw new PlanCommandError('A dimension needs two different points');
      }
      draft.dimensions[cmd.dimension.id] = cmd.dimension;
      return undefined;
    case 'dimension.patch': {
      const dim = draft.dimensions[cmd.id];
      if (!dim) throw new PlanCommandError(`Dimension "${cmd.id}" does not exist`);
      Object.assign(dim, cmd.changes);
      if (samePoint(dim.a, dim.b))
        throw new PlanCommandError('A dimension needs two different points');
      return undefined;
    }
    case 'dimension.remove':
      if (!(cmd.id in draft.dimensions)) {
        throw new PlanCommandError(`Dimension "${cmd.id}" does not exist`);
      }
      delete draft.dimensions[cmd.id];
      return undefined;
    case 'plan.rename': {
      const name = cmd.name.trim();
      if (!name) throw new PlanCommandError('A plan needs a name');
      draft.name = name;
      return undefined;
    }
    case 'plan.replace':
      return cmd.plan;
    default: {
      const unknown: never = cmd;
      throw new PlanCommandError(`Unknown command ${JSON.stringify(unknown)}`);
    }
  }
};

/**
 * `plan` with `cmds` applied in order, outside history (for previews). Each command
 * gets its own Immer step, so `plan.replace` works and unchanged objects are shared.
 */
export const applyCommands = (plan: Plan, cmds: readonly PlanCommand[]): Plan =>
  cmds.reduce((current, cmd) => produce(current, (draft) => applyCommand(draft, cmd)), plan);
