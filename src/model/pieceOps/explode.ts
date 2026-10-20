/**
 * Explode: props become the raw pieces they are, so they snap like built pieces. Each
 * prop's box (`pieceBoxes`) becomes a raw piece at its model's pivot and turn; the bill
 * of materials doesn't change. Pure.
 */
import type { Library } from '../../catalog/library';
import type { PlanCommand } from '../commands';
import { round6 } from '../geometry/round';
import { ITEM_KINDS } from '../itemKinds';
import type { PieceBox } from '../pieceBoxes';
import { pieceBoxes } from '../pieceBoxes';
import { rotationOfTurn } from '../rawBoxes';
import type { SelectionItem, SelectionKind } from '../selection';
import type { Plan, RawPiece } from '../types';

/** The kinds Explode takes apart (raw pieces already are; dimensions aren't pieces). */
const EXPLODABLE = {
  prop: 'prop.remove',
} as const satisfies Partial<Record<SelectionKind, PlanCommand['type']>>;

type ExplodableKind = keyof typeof EXPLODABLE;

export const canExplode = (item: SelectionItem): item is SelectionItem & { kind: ExplodableKind } =>
  Object.hasOwn(EXPLODABLE, item.kind);

/**
 * The raw piece a box's model is: its prefab at its pivot, turned as the model is
 * (`modelTurn`, else `rotationY`). Null without a prefab.
 */
export const rawFromBox = (box: PieceBox, id: string): RawPiece | null => {
  if (box.prefab === null) return null;
  const turn = box.modelTurn ?? { x: 0, y: box.rotationY, z: 0 };
  return {
    id,
    prefab: box.prefab,
    position: {
      x: round6(box.pivot.x),
      y: round6(box.pivot.y),
      z: round6(box.pivot.z),
    },
    rotation: rotationOfTurn(turn),
  };
};

export interface Explosion {
  cmds: PlanCommand[];
  /** The new raw pieces, to select. */
  items: SelectionItem[];
  /** The items taken apart. */
  exploded: SelectionItem[];
}

const itemKey = (item: SelectionItem): string => `${item.kind}:${item.id}`;

/**
 * Commands exploding the explodable `items` (others are ignored) into raw pieces, with
 * ids from `newId`. `boxes` are the plan's piece boxes (worked out when not given).
 */
export const explodeCommands = (
  plan: Plan,
  items: readonly SelectionItem[],
  lib: Library,
  newId: () => string,
  boxes: readonly PieceBox[] = pieceBoxes(plan, lib)
): Explosion => {
  const keys = new Set<string>();
  const exploded = items.filter(canExplode).filter((item) => {
    const key = itemKey(item);
    if (keys.has(key) || !Object.hasOwn(ITEM_KINDS[item.kind].collection(plan), item.id)) {
      return false;
    }
    keys.add(key);
    return true;
  });
  // Every prop's box has a prefab; one without would be left out.
  const pieces = boxes.flatMap((box) => {
    const piece = keys.has(itemKey(box.item)) ? rawFromBox(box, newId()) : null;
    return piece ? [piece] : [];
  });
  const cmds: PlanCommand[] = [
    ...exploded.map((item): PlanCommand => ({ type: EXPLODABLE[item.kind], id: item.id })),
    ...pieces.map((piece): PlanCommand => ({ type: 'raw.insert', piece })),
  ];
  const created = pieces.map((p): SelectionItem => ({ kind: 'raw', id: p.id }));
  return { cmds, items: created, exploded };
};

/** "Explode item (1 piece)", "Explode 3 items (3 pieces)". */
export const explodeLabel = ({
  exploded,
  items,
}: Pick<Explosion, 'exploded' | 'items'>): string => {
  const pieces = `${items.length} ${items.length === 1 ? 'piece' : 'pieces'}`;
  const [only] = exploded;
  if (exploded.length === 1 && only) return `Explode ${ITEM_KINDS[only.kind].noun} (${pieces})`;
  return `Explode ${exploded.length} items (${pieces})`;
};
