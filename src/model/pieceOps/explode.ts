/**
 * Explode: walls, floors, roofs and props become the raw pieces they are made of, so
 * single pieces can be moved, turned and removed. Each derived box (`pieceBoxes`, so the
 * split, tiling and roof code is reused as it is) becomes a raw piece at its model's
 * pivot and turn; the bill of materials doesn't change. Pure.
 */
import type { Library } from '../../catalog/library';
import type { PlanCommand } from '../commands';
import { derivePlan } from '../derivePlan';
import { normalizeDeg } from '../geometry/propGeometry';
import { ITEM_KINDS } from '../itemKinds';
import type { PieceBox } from '../pieceBoxes';
import { pieceBoxes } from '../pieceBoxes';
import { FLOOR_LIFT } from '../rawBoxes';
import type { SelectionItem, SelectionKind } from '../selection';
import type { Plan, RawPiece } from '../types';

/** The kinds Explode takes apart (an opening alone is its wall's gap; raw pieces already are). */
const EXPLODABLE = {
  wall: 'wall.remove',
  floor: 'floor.remove',
  roof: 'roof.remove',
  prop: 'prop.remove',
} as const satisfies Partial<Record<SelectionKind, PlanCommand['type']>>;

type ExplodableKind = keyof typeof EXPLODABLE;

export const canExplode = (item: SelectionItem): item is SelectionItem & { kind: ExplodableKind } =>
  Object.hasOwn(EXPLODABLE, item.kind);

const DEG = Math.PI / 180;
const round = (n: number, step: number) => Math.round(n / step) * step + 0;

/**
 * The raw piece a box's model is: its prefab at its pivot, turned as the model is
 * (`modelTurn`, else `rotationY`). Null without a prefab. A floor's box (and pivot) is
 * lifted 1 mm, which the raw piece leaves out: its box gets the lift again.
 */
export const rawFromBox = (box: PieceBox, id: string): RawPiece | null => {
  if (box.prefab === null) return null;
  const turn = box.modelTurn ?? { x: 0, y: box.rotationY, z: 0 };
  const lift = box.kind === 'floor' ? FLOOR_LIFT : 0;
  return {
    id,
    prefab: box.prefab,
    position: {
      x: round(box.pivot.x, 1e-6),
      y: round(box.pivot.y - lift - box.elevation, 1e-6),
      z: round(box.pivot.z, 1e-6),
    },
    rotation: {
      yaw: normalizeDeg(-turn.y / DEG),
      pitch: round(-turn.x / DEG, 1e-6),
      roll: round(turn.z / DEG, 1e-6),
    },
    elevation: box.elevation,
  };
};

export interface Explosion {
  cmds: PlanCommand[];
  /** The new raw pieces, to select. */
  items: SelectionItem[];
  /** The items taken apart. */
  exploded: SelectionItem[];
  /** Boxes without a prefab, left out. */
  skipped: number;
}

/** The item a box is part of for Explode: an opening's panel goes with its wall. */
const ownerOf = (plan: Plan, box: PieceBox): string => {
  if (box.item.kind !== 'opening') return `${box.item.kind}:${box.item.id}`;
  return `wall:${plan.openings[box.item.id]?.wallId ?? ''}`;
};

/**
 * Commands exploding the explodable `items` (others are ignored) into raw pieces, with
 * ids from `newId`. `boxes` are the plan's piece boxes (worked out when not given).
 */
export const explodeCommands = (
  plan: Plan,
  items: readonly SelectionItem[],
  lib: Library,
  newId: () => string,
  boxes: readonly PieceBox[] = pieceBoxes(derivePlan(plan, lib), plan, lib)
): Explosion => {
  const keys = new Set<string>();
  const exploded = items.filter(canExplode).filter((item) => {
    const key = `${item.kind}:${item.id}`;
    if (keys.has(key) || !Object.hasOwn(ITEM_KINDS[item.kind].collection(plan), item.id)) {
      return false;
    }
    keys.add(key);
    return true;
  });
  const pieces: RawPiece[] = [];
  let skipped = 0;
  for (const box of boxes) {
    if (!keys.has(ownerOf(plan, box))) continue;
    const piece = rawFromBox(box, newId());
    if (piece) pieces.push(piece);
    else skipped++;
  }
  const cmds: PlanCommand[] = [
    ...exploded.map((item): PlanCommand => ({ type: EXPLODABLE[item.kind], id: item.id })),
    ...pieces.map((piece): PlanCommand => ({ type: 'raw.insert', piece })),
  ];
  const created = pieces.map((p): SelectionItem => ({ kind: 'raw', id: p.id }));
  return { cmds, items: created, exploded, skipped };
};

/** "Explode wall (24 pieces)", "Explode 3 items (61 pieces)". */
export const explodeLabel = ({
  exploded,
  items,
}: Pick<Explosion, 'exploded' | 'items'>): string => {
  const pieces = `${items.length} ${items.length === 1 ? 'piece' : 'pieces'}`;
  const [only] = exploded;
  if (exploded.length === 1 && only) return `Explode ${ITEM_KINDS[only.kind].noun} (${pieces})`;
  return `Explode ${exploded.length} items (${pieces})`;
};
