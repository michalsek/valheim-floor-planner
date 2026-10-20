/**
 * Support for a plan's boxes: each box a body, contacts by collider overlap, then
 * propagation, on flat ground at 0 or the site's terrain. Also what the bill of
 * materials warns about: the items with pieces that would collapse.
 */
import { LOAD_BEARING_GROUPS } from '../../catalog/propDefs';
import type { MaterialSupport } from '../../catalog/pieceDefs';
import type { PieceBox } from '../pieceBoxes';
import type { SelectionItem } from '../selection';
import type { Vec2 } from '../types';

import { contactIndex, findContacts, type ContactIndex } from './contacts';
import { propagateSupport, type SupportBody, type SupportState } from './propagate';
import { boxShape, type SupportShape } from './shape';

export interface BoxSupport {
  state: SupportState;
  value: number;
  /** At the material's maximum: on the ground, or capped (wood resting on stone). */
  full: boolean;
  /**
   * The game's colour scale (`WearNTear.GetSupportColorValue`, as recalled): from the
   * material's minimum (0) to half its maximum (1), clamped.
   */
  ratio: number;
}

export interface CollapseLine {
  item: SelectionItem;
  /** How many of its pieces would collapse. */
  count: number;
}

export interface PlanSupport {
  /** By `PieceBox.key`. */
  byKey: ReadonlyMap<string, BoxSupport>;
  /** Items with pieces that would collapse, in box order. */
  collapsing: CollapseLine[];
}

/**
 * Raw pieces carry weight (the catalogue doesn't say which can't, `m_supports`), and so
 * do stair, ladder, pole and beam props; furniture and stations don't.
 */
const gives = (box: PieceBox): boolean =>
  box.kind === 'raw' || (box.group !== null && LOAD_BEARING_GROUPS.has(box.group));

/** The highest ground (plan height) under a plan footprint. */
export type GroundUnder = (footprint: readonly Vec2[]) => number;

type Materials = Record<string, MaterialSupport>;

/** A box as a support body (raw pieces included: they are checked since M17). */
export const bodyOf = (
  box: PieceBox,
  shape: SupportShape,
  materials: Materials,
  groundUnder: GroundUnder | null
): SupportBody => ({
  com: shape.com,
  bottom: shape.aabb.min.y,
  ground: groundUnder ? groundUnder(shape.footprint) : 0,
  material: (box.material !== null && materials[box.material]) || null,
  gives: gives(box),
});

/** A box list's support bodies and their contact hash: what a commit's support is built on. */
export interface SupportModel {
  boxes: readonly PieceBox[];
  shapes: readonly SupportShape[];
  bodies: readonly SupportBody[];
  index: ContactIndex;
  indexOf: ReadonlyMap<string, number>;
  materials: Materials;
  groundUnder: GroundUnder | null;
}

/** `groundUnder` is the site's terrain; without it the ground is flat at 0. */
export const supportModel = (
  boxes: readonly PieceBox[],
  materials: Materials,
  groundUnder: GroundUnder | null = null
): SupportModel => {
  const shapes = boxes.map(boxShape);
  return {
    boxes,
    shapes,
    bodies: boxes.map((box, i) => bodyOf(box, shapes[i]!, materials, groundUnder)),
    index: contactIndex(shapes),
    indexOf: new Map(boxes.map((box, i) => [box.key, i])),
    materials,
    groundUnder,
  };
};

/** How a body's support reads: its colour ratio and whether it is at its maximum. */
export const boxSupportOf = (
  material: MaterialSupport | null,
  value: number,
  state: SupportState
): BoxSupport => {
  const span = material ? material.maxSupport / 2 - material.minSupport : 1;
  const ratio = material ? Math.min(1, Math.max(0, (value - material.minSupport) / span)) : 0;
  const full = material !== null && value >= material.maxSupport - 1e-3;
  return { state, value, full, ratio };
};

/**
 * Support of every box of a model. `extra` pairs boxes (by `PieceBox.key`) that rest on
 * each other whatever their shapes say (`snapJoints`: pieces joined at a snap point).
 */
export const modelSupport = (
  model: SupportModel,
  extra: readonly (readonly [string, string])[] = []
): PlanSupport => {
  const { boxes, shapes, bodies, indexOf } = model;
  const pairs = extra.flatMap(([a, b]) => {
    const [i, j] = [indexOf.get(a), indexOf.get(b)];
    return i === undefined || j === undefined ? [] : [[i, j] as const];
  });
  const contacts = findContacts(shapes, model.index.eps, pairs, model.index);
  const { value, state } = propagateSupport(bodies, contacts);

  const byKey = new Map<string, BoxSupport>();
  const collapsing = new Map<string, CollapseLine>();
  boxes.forEach((box, i) => {
    byKey.set(box.key, boxSupportOf(bodies[i]!.material, value[i]!, state[i]!));
    if (state[i] !== 'collapsing') return;
    const key = `${box.item.kind}:${box.item.id}`;
    const line = collapsing.get(key);
    if (line) line.count++;
    else collapsing.set(key, { item: box.item, count: 1 });
  });
  return { byKey, collapsing: [...collapsing.values()] };
};

/** Support of every box (see `modelSupport`, `supportModel`). */
export const planSupport = (
  boxes: readonly PieceBox[],
  materials: Materials,
  extra: readonly (readonly [string, string])[] = [],
  groundUnder: GroundUnder | null = null
): PlanSupport => modelSupport(supportModel(boxes, materials, groundUnder), extra);
