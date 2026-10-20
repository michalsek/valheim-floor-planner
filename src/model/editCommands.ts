/**
 * The plan commands behind selection edits: move, delete, duplicate and turn.
 * Pure, so the Select tool previews a gesture with exactly the commands it later
 * commits. Per-kind work is in `ITEM_KINDS`.
 */
import { propRect } from '../catalog/propDefs';

import { applyCommands, type PlanCommand } from './commands';
import { rotateAboutCentre } from './geometry/propGeometry';
import { ITEM_KINDS, type KindLib } from './itemKinds';
import { rotateRaw } from './rawBoxes';
import { itemExists, type Selection, type SelectionItem } from './selection';
import type { Plan, Vec2 } from './types';

/** Commands moving every item by `d` (none for a zero move or missing items). */
export const translateCommands = (plan: Plan, items: Selection, d: Vec2): PlanCommand[] =>
  d.x === 0 && d.z === 0
    ? []
    : items.flatMap((item) => ITEM_KINDS[item.kind].translate(plan, item.id, d));

/** Deletes the items. */
export const removeCommands = (plan: Plan, items: Selection): PlanCommand[] =>
  items.flatMap((item) => ITEM_KINDS[item.kind].remove(plan, item.id));

/**
 * Copies of the existing items moved by `d`, with ids from `newId`, and the copies as
 * items. Each item is copied into the plan with the earlier copies already in, so a full
 * plan makes no more.
 */
export const duplicateCommands = (
  plan: Plan,
  items: Selection,
  d: Vec2,
  newId: () => string
): { cmds: PlanCommand[]; items: SelectionItem[] } => {
  const cmds: PlanCommand[] = [];
  const copies: SelectionItem[] = [];
  let draft = plan;
  for (const item of items.filter((i) => itemExists(plan, i))) {
    const copy = { ...item, id: newId() };
    const made = ITEM_KINDS[item.kind].duplicate(draft, item.id, copy.id, d);
    if (made.length === 0) continue;
    draft = applyCommands(draft, made);
    cmds.push(...made);
    copies.push(copy);
  }
  return { cmds, items: copies };
};

/** The selected props and raw pieces turned by `deltaDeg`, each about its footprint's centre. */
export const rotateCommands = (
  plan: Plan,
  items: Selection,
  deltaDeg: number,
  lib: KindLib
): PlanCommand[] =>
  items.flatMap((item): PlanCommand[] => {
    const raw = item.kind === 'raw' ? plan.rawPieces[item.id] : undefined;
    if (raw) return [{ type: 'raw.patch', id: raw.id, changes: rotateRaw(raw, deltaDeg, lib) }];
    const prop = item.kind === 'prop' ? plan.props[item.id] : undefined;
    if (!prop) return [];
    const about = lib.propDefs.get(prop.prefab)?.snap?.centre;
    const changes = rotateAboutCentre(prop, propRect(lib.propDefs, prop.prefab), deltaDeg, about);
    return [{ type: 'prop.patch', id: prop.id, changes }];
  });
