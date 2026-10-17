/**
 * Support for a plan's boxes: each box a body, contacts by collider overlap, then
 * propagation. Also what the bill of materials warns about: the items with pieces that
 * would collapse.
 */
import { LOAD_BEARING_GROUPS } from '../../catalog/propDefs';
import type { MaterialSupport } from '../../catalog/pieceDefs';
import type { PieceBox } from '../pieceBoxes';
import type { SelectionItem } from '../selection';

import { findContacts } from './contacts';
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

/** Walls, floors, roofs, stairs and poles carry weight; doors, furniture and stations don't. */
const gives = (box: PieceBox): boolean =>
  box.kind === 'wall' ||
  box.kind === 'floor' ||
  box.kind === 'roof' ||
  (box.kind === 'prop' && box.group !== null && LOAD_BEARING_GROUPS.has(box.group));

const bodyOf = (
  box: PieceBox,
  shape: SupportShape,
  materials: Record<string, MaterialSupport>
): SupportBody => ({
  com: shape.com,
  bottom: shape.aabb.min.y,
  material: (box.material !== null && materials[box.material]) || null,
  gives: gives(box),
});

/**
 * Support of every box. `extra` pairs boxes (by `PieceBox.key`) that rest on each other
 * whatever their shapes say (`roofContacts`: a roof piece on a wall's top edge).
 */
export const planSupport = (
  boxes: readonly PieceBox[],
  materials: Record<string, MaterialSupport>,
  extra: readonly (readonly [string, string])[] = []
): PlanSupport => {
  const shapes = boxes.map(boxShape);
  const bodies = boxes.map((box, i) => bodyOf(box, shapes[i]!, materials));
  const indexOf = new Map(boxes.map((box, i) => [box.key, i]));
  const pairs = extra.flatMap(([a, b]) => {
    const [i, j] = [indexOf.get(a), indexOf.get(b)];
    return i === undefined || j === undefined ? [] : [[i, j] as const];
  });
  const { value, state } = propagateSupport(bodies, findContacts(shapes, undefined, pairs));

  const byKey = new Map<string, BoxSupport>();
  const collapsing = new Map<string, CollapseLine>();
  boxes.forEach((box, i) => {
    const material = bodies[i]!.material;
    const v = value[i]!;
    const span = material ? material.maxSupport / 2 - material.minSupport : 1;
    const ratio = material ? Math.min(1, Math.max(0, (v - material.minSupport) / span)) : 0;
    const full = material !== null && v >= material.maxSupport - 1e-3;
    byKey.set(box.key, { state: state[i]!, value: v, full, ratio });
    if (state[i] !== 'collapsing') return;
    const key = `${box.item.kind}:${box.item.id}`;
    const line = collapsing.get(key);
    if (line) line.count++;
    else collapsing.set(key, { item: box.item, count: 1 });
  });
  return { byKey, collapsing: [...collapsing.values()] };
};
