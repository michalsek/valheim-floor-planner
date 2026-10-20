/**
 * Everything selection needs to know about each kind of plan object, in one place.
 * The mapped type makes a missing kind a compile error: adding a kind means a
 * `SelectionItem` member, an entry here, and its own files.
 */
import { propRect } from '../catalog/propDefs';

import type { PlanCommand } from './commands';
import type { BoxMode, Polyline, WorldBox } from './geometry/box';
import { dimensionLine } from './geometry/dimension';
import { addVec } from './geometry/polyline';
import { propBoxTest, propCorners } from './geometry/propGeometry';
import { roundElevation } from './elevation';
import { round6 } from './geometry/round';
import type { BoxLib } from './pieceBoxes';
import { MAX_PROPS } from './props';
import { convexBoxTest } from './geometry/convex';
import { rawOutline } from './rawBoxes';
import { MAX_RAW_PIECES } from './rawPieces';
import type { SelectionKind } from './selection';
import type { Plan, Vec2 } from './types';

/** The catalogue data item kinds read: what their boxes are made from. */
export type KindLib = BoxLib;

export interface ItemKind {
  /** How one item is named in history labels ("Move item"). */
  noun: string;
  /** The plan record holding the kind's objects, by id. */
  collection(plan: Plan): Readonly<Record<string, unknown>>;
  /** The absolute height an item stands at (a raw piece: its pivot's y); null when it is gone. */
  elevation(plan: Plan, id: string): number | null;
  /** Commands raising (or lowering) it by `dy`. */
  raise(plan: Plan, id: string, dy: number): PlanCommand[];
  /** The item's drawn lines; box selection tests these (unless the kind has `inBox`). */
  lines(plan: Plan, id: string, lib: KindLib): Polyline[];
  /** Box selection of an area (props: a rotated footprint the box may lie inside). */
  inBox?(plan: Plan, id: string, box: WorldBox, mode: BoxMode, lib: KindLib): boolean;
  /**
   * Lines `SelectionHighlight` strokes. Left out when the kind shows its own selected
   * state (dimensions recolour themselves).
   */
  highlight?(plan: Plan, id: string, lib: KindLib): Polyline[];
  translate(plan: Plan, id: string, d: Vec2): PlanCommand[];
  remove(plan: Plan, id: string): PlanCommand[];
  /** A copy of an existing item, moved by `d`, under `copyId` (none when it can't be). */
  duplicate(plan: Plan, id: string, copyId: string, d: Vec2): PlanCommand[];
}

const raised = (o: { elevation: number } | undefined, dy: number) =>
  o && { elevation: roundElevation(o.elevation + dy) };

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

const rawLines = (plan: Plan, id: string, lib: KindLib): Polyline[] => {
  const piece = plan.rawPieces[id];
  return piece ? [{ points: rawOutline(piece, lib), closed: true }] : [];
};

/** Key order is `allItems`' order. */
export const ITEM_KINDS: { readonly [K in SelectionKind]: ItemKind } = {
  dimension: {
    noun: 'dimension',
    collection: (plan) => plan.dimensions,
    elevation: (plan, id) => plan.dimensions[id]?.elevation ?? null,
    raise: (plan, id, dy) => {
      const changes = raised(plan.dimensions[id], dy);
      return changes ? [{ type: 'dimension.patch', id, changes }] : [];
    },
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
    duplicate: (plan, id, copyId, d) => {
      const dim = plan.dimensions[id];
      if (!dim) return [];
      const dimension = { ...dim, id: copyId, a: addVec(dim.a, d), b: addVec(dim.b, d) };
      return [{ type: 'dimension.insert', dimension }];
    },
  },
  prop: {
    noun: 'item',
    collection: (plan) => plan.props,
    elevation: (plan, id) => plan.props[id]?.elevation ?? null,
    raise: (plan, id, dy) => {
      const changes = raised(plan.props[id], dy);
      return changes ? [{ type: 'prop.patch', id, changes }] : [];
    },
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
    duplicate: (plan, id, copyId, d) => {
      const prop = plan.props[id];
      if (!prop || Object.keys(plan.props).length >= MAX_PROPS) return [];
      return [
        { type: 'prop.insert', prop: { ...prop, id: copyId, position: addVec(prop.position, d) } },
      ];
    },
  },
  raw: {
    noun: 'piece',
    collection: (plan) => plan.rawPieces,
    elevation: (plan, id) => plan.rawPieces[id]?.position.y ?? null,
    raise: (plan, id, dy) => {
      const piece = plan.rawPieces[id];
      if (!piece) return [];
      const position = { ...piece.position, y: round6(piece.position.y + dy) };
      return [{ type: 'raw.patch', id, changes: { position } }];
    },
    lines: rawLines,
    highlight: rawLines,
    inBox: (plan, id, box, mode, lib) => {
      const piece = plan.rawPieces[id];
      return piece !== undefined && convexBoxTest(rawOutline(piece, lib), box, mode);
    },
    translate: (plan, id, d) => {
      const piece = plan.rawPieces[id];
      if (!piece) return [];
      const { x, y, z } = piece.position;
      return [{ type: 'raw.patch', id, changes: { position: { x: x + d.x, y, z: z + d.z } } }];
    },
    remove: (_plan, id) => [{ type: 'raw.remove', id }],
    duplicate: (plan, id, copyId, d) => {
      const piece = plan.rawPieces[id];
      if (!piece || Object.keys(plan.rawPieces).length >= MAX_RAW_PIECES) return [];
      const { x, y, z } = piece.position;
      const position = { x: x + d.x, y, z: z + d.z };
      return [{ type: 'raw.insert', piece: { ...piece, id: copyId, position } }];
    },
  },
};

export const SELECTION_KINDS = Object.keys(ITEM_KINDS) as SelectionKind[];
