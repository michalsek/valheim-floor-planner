/** Plan edits. Every change to the plan document goes through one of these. */
import type { Plan, WallId, WallRun } from '../model/types';

export type PlanCommand =
  | { type: 'wall.insert'; wall: WallRun }
  | { type: 'wall.patch'; id: WallId; changes: Partial<Omit<WallRun, 'id'>> }
  | { type: 'wall.remove'; id: WallId }
  | { type: 'plan.replace'; plan: Plan };

/** The history label a command gets unless the caller names the gesture. */
export const COMMAND_LABELS: Record<PlanCommand['type'], string> = {
  'wall.insert': 'Add wall',
  'wall.patch': 'Edit wall',
  'wall.remove': 'Delete wall',
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
    case 'plan.replace':
      return cmd.plan;
    default: {
      const unknown: never = cmd;
      throw new PlanCommandError(`Unknown command ${JSON.stringify(unknown)}`);
    }
  }
};
