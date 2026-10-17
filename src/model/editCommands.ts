/**
 * The plan commands behind selection edits: move, corner drag, delete and duplicate.
 * Pure, so the Select tool previews a gesture with exactly the commands it later
 * commits. Per-kind work is in `ITEM_KINDS`.
 */
import { propRect } from '../catalog/propDefs';

import { applyCommands, type PlanCommand } from './commands';
import { samePoint } from './geometry/polyline';
import { rotateAboutCentre } from './geometry/propGeometry';
import { ITEM_KINDS, slidingOpeningIds, type EditScope } from './itemKinds';
import { carryOpenings, openingsOf, slideOpenings } from './openings';
import { rotateRaw } from './rawBoxes';
import { itemExists, type Selection, type SelectionItem } from './selection';
import type { OpeningId, Plan, Vec2, WallRun } from './types';
import { dragVertex, moveVertexRaw } from './vertexDrag';

type EditLib = EditScope['lib'];

/** Commands moving every item by `d` (none for a zero move or missing items). */
export const translateCommands = (
  plan: Plan,
  items: Selection,
  d: Vec2,
  lib: EditLib
): PlanCommand[] =>
  d.x === 0 && d.z === 0
    ? []
    : items.flatMap((item) => ITEM_KINDS[item.kind].translate(plan, item.id, d, { lib, items }));

/**
 * The sliding openings (see `slidingOpeningIds`) whose slide by `d` is refused. They
 * get no command from `translateCommands`; a drag keeps their last valid position.
 */
export const refusedSlides = (
  plan: Plan,
  items: Selection,
  d: Vec2,
  lib: EditLib
): Set<OpeningId> => {
  const results = slideOpenings(plan, lib, slidingOpeningIds(plan, items), d);
  return new Set([...results].flatMap(([id, result]) => (result === 'refused' ? [id] : [])));
};

/** Deletes the items; an opening whose wall is deleted too goes with the wall. */
export const removeCommands = (plan: Plan, items: Selection, lib: EditLib): PlanCommand[] =>
  items.flatMap((item) => ITEM_KINDS[item.kind].remove(plan, item.id, { lib, items }));

/**
 * Copies of the existing items moved by `d`, with ids from `newId`, and the copies as
 * items. Each item is copied into the plan with the earlier copies already in, so two
 * opening copies can't land in the same place.
 */
export const duplicateCommands = (
  plan: Plan,
  items: Selection,
  d: Vec2,
  newId: () => string,
  lib: EditLib
): { cmds: PlanCommand[]; items: SelectionItem[] } => {
  const cmds: PlanCommand[] = [];
  const copies: SelectionItem[] = [];
  let draft = plan;
  for (const item of items.filter((i) => itemExists(plan, i))) {
    const copy = { ...item, id: newId() };
    const scope = { lib, items };
    const made = ITEM_KINDS[item.kind].duplicate(draft, item.id, { id: copy.id, newId }, d, scope);
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
  lib: EditLib
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

const sameShape = (a: Pick<WallRun, 'points' | 'side'>, run: WallRun): boolean =>
  a.side === run.side &&
  a.points.length === run.points.length &&
  a.points.every((p, i) => {
    const q = run.points[i];
    return q !== undefined && samePoint(p, q);
  });

/**
 * Commands for dragging corner `index` of `run` to `target`: null when the drag is
 * refused (the run would collapse), `[]` when the run is unchanged. The wall's
 * openings in `plan` follow their segments across (see `carryOpenings`).
 */
export const vertexDragCommands = (
  plan: Plan,
  run: WallRun,
  index: number,
  target: Vec2
): PlanCommand[] | null => {
  const result = dragVertex(run, index, target);
  if (!result) return null;
  if (sameShape(result, run)) return [];
  const moved = moveVertexRaw(run.points, run.closed, index, target);
  return [
    { type: 'wall.patch', id: run.id, changes: result },
    ...carryOpenings(run, moved, openingsOf(plan, run.id)).map(({ id, at }): PlanCommand => ({
      type: 'opening.patch',
      id,
      changes: { at },
    })),
  ];
};
