/**
 * Everything selection needs to know about each kind of plan object, in one place.
 * The mapped type makes a missing kind a compile error: adding a kind (floors,
 * openings, props) means a `SelectionItem` member, an entry here, and its own files.
 */
import type { PlanCommand } from './commands';
import type { Polyline } from './geometry/box';
import { dimensionLine } from './geometry/dimension';
import { addVec } from './geometry/polyline';
import type { SelectionKind } from './selection';
import type { Plan, Vec2 } from './types';

export interface ItemKind {
  /** How one item is named in history labels ("Move wall"). */
  noun: string;
  /** The plan record holding the kind's objects, by id. */
  collection(plan: Plan): Readonly<Record<string, unknown>>;
  /** The item's drawn lines; box selection tests these. */
  lines(plan: Plan, id: string): Polyline[];
  /**
   * Lines `SelectionHighlight` strokes (next to the item's pieces). Left out when the
   * kind shows its own selected state (dimensions recolour themselves).
   */
  highlight?(plan: Plan, id: string): Polyline[];
  translate(plan: Plan, id: string, d: Vec2): PlanCommand[];
  remove(id: string): PlanCommand[];
  /** A copy of an existing item, moved by `d`, under `copyId`. */
  duplicate(plan: Plan, id: string, copyId: string, d: Vec2): PlanCommand[];
}

const shift = (points: readonly Vec2[], d: Vec2): Vec2[] => points.map((p) => addVec(p, d));

const wallLines = (plan: Plan, id: string): Polyline[] => {
  const run = plan.walls[id];
  return run ? [{ points: run.points, closed: run.closed }] : [];
};

/** Key order is `allItems`' order. */
export const ITEM_KINDS: { readonly [K in SelectionKind]: ItemKind } = {
  wall: {
    noun: 'wall',
    collection: (plan) => plan.walls,
    lines: wallLines,
    highlight: wallLines,
    translate: (plan, id, d) => {
      const run = plan.walls[id];
      return run ? [{ type: 'wall.patch', id, changes: { points: shift(run.points, d) } }] : [];
    },
    remove: (id) => [{ type: 'wall.remove', id }],
    duplicate: (plan, id, copyId, d) => {
      const run = plan.walls[id];
      if (!run) return [];
      return [{ type: 'wall.insert', wall: { ...run, id: copyId, points: shift(run.points, d) } }];
    },
  },
  dimension: {
    noun: 'dimension',
    collection: (plan) => plan.dimensions,
    lines: (plan, id) => {
      const dim = plan.dimensions[id];
      if (!dim) return [];
      const { a, b } = dimensionLine(dim);
      return [{ points: [a, b], closed: false }];
    },
    translate: (plan, id, d) => {
      const dim = plan.dimensions[id];
      if (!dim) return [];
      return [
        { type: 'dimension.patch', id, changes: { a: addVec(dim.a, d), b: addVec(dim.b, d) } },
      ];
    },
    remove: (id) => [{ type: 'dimension.remove', id }],
    duplicate: (plan, id, copyId, d) => {
      const dim = plan.dimensions[id];
      if (!dim) return [];
      const dimension = { ...dim, id: copyId, a: addVec(dim.a, d), b: addVec(dim.b, d) };
      return [{ type: 'dimension.insert', dimension }];
    },
  },
};

export const SELECTION_KINDS = Object.keys(ITEM_KINDS) as SelectionKind[];
