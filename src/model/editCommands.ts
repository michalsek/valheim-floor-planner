/**
 * The plan commands behind selection edits: move, corner drag, delete and duplicate.
 * Pure, so the Select tool previews a gesture with exactly the commands it later
 * commits. Per-kind work is in `ITEM_KINDS`.
 */
import type { PlanCommand } from './commands';
import { samePoint } from './geometry/polyline';
import { ITEM_KINDS } from './itemKinds';
import { itemExists, type Selection, type SelectionItem } from './selection';
import type { Plan, Vec2, WallRun } from './types';
import { dragVertex } from './vertexDrag';

/** Commands moving every item by `d` (none for a zero move or missing items). */
export const translateCommands = (plan: Plan, items: Selection, d: Vec2): PlanCommand[] =>
  d.x === 0 && d.z === 0
    ? []
    : items.flatMap((item) => ITEM_KINDS[item.kind].translate(plan, item.id, d));

export const removeCommands = (items: Selection): PlanCommand[] =>
  items.flatMap((item) => ITEM_KINDS[item.kind].remove(item.id));

/** Copies of the existing items moved by `d`, with ids from `newId`, and the copies as items. */
export const duplicateCommands = (
  plan: Plan,
  items: Selection,
  d: Vec2,
  newId: () => string
): { cmds: PlanCommand[]; items: SelectionItem[] } => {
  const cmds: PlanCommand[] = [];
  const copies: SelectionItem[] = [];
  for (const item of items.filter((i) => itemExists(plan, i))) {
    const copy = { ...item, id: newId() };
    cmds.push(...ITEM_KINDS[item.kind].duplicate(plan, item.id, copy.id, d));
    copies.push(copy);
  }
  return { cmds, items: copies };
};

const sameShape = (a: Pick<WallRun, 'points' | 'side'>, run: WallRun): boolean =>
  a.side === run.side &&
  a.points.length === run.points.length &&
  a.points.every((p, i) => {
    const q = run.points[i];
    return q !== undefined && samePoint(p, q);
  });

/**
 * Commands for dragging corner `index` of `run` to `target`: null when the drag is
 * refused (the run would collapse), `[]` when the run is unchanged.
 */
export const vertexDragCommands = (
  run: WallRun,
  index: number,
  target: Vec2
): PlanCommand[] | null => {
  const result = dragVertex(run, index, target);
  if (!result) return null;
  return sameShape(result, run) ? [] : [{ type: 'wall.patch', id: run.id, changes: result }];
};
