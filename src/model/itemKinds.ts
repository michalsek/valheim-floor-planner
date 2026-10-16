/**
 * Everything selection needs to know about each kind of plan object, in one place.
 * The mapped type makes a missing kind a compile error: adding a kind (props) means a
 * `SelectionItem` member, an entry here, and its own files.
 */
import type { Library } from '../catalog/library';
import { propRect } from '../catalog/propDefs';

import type { PlanCommand } from './commands';
import { boxOutline, type BoxMode, type Polyline, type WorldBox } from './geometry/box';
import { dimensionLine } from './geometry/dimension';
import { addVec } from './geometry/polyline';
import { propBoxTest, propCorners } from './geometry/propGeometry';
import { besideOpening, openingsOf, slideOpenings } from './openings';
import { MAX_PROPS } from './props';
import { isSelected, type Selection, type SelectionKind } from './selection';
import type { OpeningId, Plan, Vec2, WallId } from './types';

/** The catalogue data item kinds read. */
export type KindLib = Pick<Library, 'wallFamilies' | 'openingDefs' | 'propDefs'>;

/** What an edit spans: the catalogue, and every item it acts on together. */
export interface EditScope {
  lib: KindLib;
  /** A wall's openings follow the wall, so an opening whose wall is here is left alone. */
  items: Selection;
}

export interface ItemKind {
  /** How one item is named in history labels ("Move wall"). */
  noun: string;
  /** The plan record holding the kind's objects, by id. */
  collection(plan: Plan): Readonly<Record<string, unknown>>;
  /** The item's drawn lines; box selection tests these (unless the kind has `inBox`). */
  lines(plan: Plan, id: string, lib: KindLib): Polyline[];
  /** Box selection of an area (props: a rotated footprint the box may lie inside). */
  inBox?(plan: Plan, id: string, box: WorldBox, mode: BoxMode, lib: KindLib): boolean;
  /**
   * Lines `SelectionHighlight` strokes (next to the item's pieces). Left out when the
   * kind shows its own selected state (dimensions recolour themselves, openings their
   * symbols).
   */
  highlight?(plan: Plan, id: string, lib: KindLib): Polyline[];
  translate(plan: Plan, id: string, d: Vec2, scope: EditScope): PlanCommand[];
  remove(plan: Plan, id: string, scope: EditScope): PlanCommand[];
  /** A copy of an existing item, moved by `d`, under `copyId` (none when it can't be). */
  duplicate(
    plan: Plan,
    id: string,
    copy: { id: string; newId: () => string },
    d: Vec2,
    scope: EditScope
  ): PlanCommand[];
}

const shift = (points: readonly Vec2[], d: Vec2): Vec2[] => points.map((p) => addVec(p, d));

const wallLines = (plan: Plan, id: string): Polyline[] => {
  const run = plan.walls[id];
  return run ? [{ points: run.points, closed: run.closed }] : [];
};

const floorLines = (plan: Plan, id: string): Polyline[] => {
  const floor = plan.floors[id];
  return floor ? [boxOutline(floor)] : [];
};

/** Whether the wall an opening is on is part of the same edit. */
const wallInScope = (scope: Pick<EditScope, 'items'>, wallId: WallId | undefined): boolean =>
  wallId !== undefined && isSelected(scope.items, { kind: 'wall', id: wallId });

/** The openings in `items` that slide along their walls: those whose wall isn't moved too. */
export const slidingOpeningIds = (plan: Plan, items: Selection): OpeningId[] =>
  items.flatMap((item) =>
    item.kind === 'opening' && !wallInScope({ items }, plan.openings[item.id]?.wallId)
      ? [item.id]
      : []
  );

const propOutline = (plan: Plan, id: string, lib: KindLib) => {
  const prop = plan.props[id];
  return prop
    ? propCorners(prop.position, prop.rotation, propRect(lib.propDefs, prop.prefab))
    : null;
};

const propLines = (plan: Plan, id: string, lib: KindLib): Polyline[] => {
  const corners = propOutline(plan, id, lib);
  return corners ? [{ points: corners, closed: true }] : [];
};

/** Key order is `allItems`' order. */
export const ITEM_KINDS: { readonly [K in SelectionKind]: ItemKind } = {
  wall: {
    noun: 'wall',
    collection: (plan) => plan.walls,
    lines: wallLines,
    highlight: wallLines,
    // The wall's openings move with it.
    translate: (plan, id, d) => {
      const run = plan.walls[id];
      if (!run) return [];
      return [
        { type: 'wall.patch', id, changes: { points: shift(run.points, d) } },
        ...openingsOf(plan, id).map((o): PlanCommand => ({
          type: 'opening.patch',
          id: o.id,
          changes: { at: addVec(o.at, d) },
        })),
      ];
    },
    // `wall.remove` deletes the wall's openings too.
    remove: (_plan, id) => [{ type: 'wall.remove', id }],
    duplicate: (plan, id, copy, d) => {
      const run = plan.walls[id];
      if (!run) return [];
      return [
        { type: 'wall.insert', wall: { ...run, id: copy.id, points: shift(run.points, d) } },
        ...openingsOf(plan, id).map((o): PlanCommand => ({
          type: 'opening.insert',
          opening: { ...o, id: copy.newId(), wallId: copy.id, at: addVec(o.at, d) },
        })),
      ];
    },
  },
  opening: {
    noun: 'opening',
    collection: (plan) => plan.openings,
    lines: (plan, id) => {
      const opening = plan.openings[id];
      return opening ? [{ points: [opening.at], closed: false }] : [];
    },
    // Without its wall, an opening slides along it, together with the others sliding
    // (no change when the slide is refused or comes to nothing).
    translate: (plan, id, d, scope) => {
      if (wallInScope(scope, plan.openings[id]?.wallId)) return [];
      const result = slideOpenings(plan, scope.lib, slidingOpeningIds(plan, scope.items), d).get(
        id
      );
      return typeof result === 'object'
        ? [{ type: 'opening.patch', id, changes: { at: result.at } }]
        : [];
    },
    remove: (plan, id, scope) =>
      wallInScope(scope, plan.openings[id]?.wallId) ? [] : [{ type: 'opening.remove', id }],
    // Without its wall, the copy goes right next to the original, after or before it.
    duplicate: (plan, id, copy, _d, scope) => {
      const opening = plan.openings[id];
      if (!opening || wallInScope(scope, opening.wallId)) return [];
      const at = besideOpening(plan, scope.lib, id);
      return at ? [{ type: 'opening.insert', opening: { ...opening, id: copy.id, at } }] : [];
    },
  },
  floor: {
    noun: 'floor',
    collection: (plan) => plan.floors,
    lines: floorLines,
    highlight: floorLines,
    translate: (plan, id, d) => {
      const floor = plan.floors[id];
      if (!floor) return [];
      return [
        {
          type: 'floor.patch',
          id,
          changes: { min: addVec(floor.min, d), max: addVec(floor.max, d) },
        },
      ];
    },
    remove: (_plan, id) => [{ type: 'floor.remove', id }],
    duplicate: (plan, id, copy, d) => {
      const floor = plan.floors[id];
      if (!floor) return [];
      const copied = {
        ...floor,
        id: copy.id,
        min: addVec(floor.min, d),
        max: addVec(floor.max, d),
      };
      return [{ type: 'floor.insert', floor: copied }];
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
    remove: (_plan, id) => [{ type: 'dimension.remove', id }],
    duplicate: (plan, id, copy, d) => {
      const dim = plan.dimensions[id];
      if (!dim) return [];
      const dimension = { ...dim, id: copy.id, a: addVec(dim.a, d), b: addVec(dim.b, d) };
      return [{ type: 'dimension.insert', dimension }];
    },
  },
  prop: {
    noun: 'item',
    collection: (plan) => plan.props,
    lines: propLines,
    highlight: propLines,
    inBox: (plan, id, box, mode, lib) => {
      const corners = propOutline(plan, id, lib);
      return corners !== null && propBoxTest(corners, box, mode);
    },
    translate: (plan, id, d) => {
      const prop = plan.props[id];
      return prop
        ? [{ type: 'prop.patch', id, changes: { position: addVec(prop.position, d) } }]
        : [];
    },
    remove: (_plan, id) => [{ type: 'prop.remove', id }],
    // `plan` has the earlier copies in, so a full plan makes no more.
    duplicate: (plan, id, copy, d) => {
      const prop = plan.props[id];
      if (!prop || Object.keys(plan.props).length >= MAX_PROPS) return [];
      return [
        { type: 'prop.insert', prop: { ...prop, id: copy.id, position: addVec(prop.position, d) } },
      ];
    },
  },
};

export const SELECTION_KINDS = Object.keys(ITEM_KINDS) as SelectionKind[];
