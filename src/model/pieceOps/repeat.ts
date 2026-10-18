/**
 * Repeat for raw pieces: copies of the selection in a row, along, across or up the
 * primary (first) piece's frame, a step apart; by default the selection's snap extent
 * along that way, so copies meet end to end as snapped pieces do. Pure.
 */
import { boxSnapPoints } from '../build/snapPoints';
import type { PlanCommand } from '../commands';
import { boxAxes, boxCorners } from '../geometry/orient';
import { round6 } from '../geometry/round';
import { rawBox, rawTurn } from '../rawBoxes';
import type { RawShapeLib } from '../rawShapes';
import type { SelectionItem } from '../selection';
import type { Plan, RawPiece, Vec3 } from '../types';

/** Along the primary piece's local x, across it (local z), or up. */
export type RepeatAxis = 'along' | 'across' | 'up';

export interface RepeatOptions {
  /** How many in the row, the selection included (2–50). */
  count: number;
  axis: RepeatAxis;
  /** Which way along the axis. */
  sign: 1 | -1;
  /** Metres between copies. */
  step: number;
}

export const MIN_REPEAT = 2;
export const MAX_REPEAT = 50;

const rawOf = (plan: Plan, items: readonly SelectionItem[]): RawPiece[] =>
  items.flatMap((item) => {
    const piece = item.kind === 'raw' ? plan.rawPieces[item.id] : undefined;
    return piece ? [piece] : [];
  });

/** The axis as a world direction: the primary piece's local x or z on the plan (its yaw), or up. */
export const repeatDirection = (primary: RawPiece, axis: RepeatAxis): Vec3 => {
  if (axis === 'up') return { x: 0, y: 1, z: 0 };
  const [x, , z] = boxAxes({ rotationY: rawTurn(primary.rotation).rotationY });
  return axis === 'along' ? x : z;
};

const extentAlong = (points: readonly Vec3[], d: Vec3): number => {
  const along = points.map((p) => p.x * d.x + p.y * d.y + p.z * d.z);
  return along.length === 0 ? 0 : Math.max(...along) - Math.min(...along);
};

/**
 * The selected raw pieces' extent along `axis`: their snap points', or (when those
 * don't spread that way, a floor going up) their boxes'. Rounded to the millimetre.
 */
export const setSnapExtent = (
  plan: Plan,
  items: readonly SelectionItem[],
  axis: RepeatAxis,
  lib: RawShapeLib
): number => {
  const pieces = rawOf(plan, items);
  const [primary] = pieces;
  if (!primary) return 0;
  const d = repeatDirection(primary, axis);
  const boxes = pieces.map((piece) => rawBox(piece, lib));
  const snaps = extentAlong(
    boxes.flatMap((box) => boxSnapPoints(box, lib)),
    d
  );
  const extent = snaps > 1e-3 ? snaps : extentAlong(boxes.flatMap(boxCorners), d);
  return Math.round(extent * 1000) / 1000;
};

/**
 * Commands adding `count − 1` copies of the selected raw pieces (others are ignored),
 * each a step further along, and the copies as items.
 */
export const repeatCommands = (
  plan: Plan,
  items: readonly SelectionItem[],
  { count, axis, sign, step }: RepeatOptions,
  newId: () => string
): { cmds: PlanCommand[]; items: SelectionItem[] } => {
  const pieces = rawOf(plan, items);
  const [primary] = pieces;
  if (!primary) return { cmds: [], items: [] };
  const d = repeatDirection(primary, axis);
  const n = Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Math.round(count)));
  const copies = Array.from({ length: n - 1 }, (_, k) => {
    const t = sign * step * (k + 1);
    return pieces.map((piece): RawPiece => ({
      ...piece,
      id: newId(),
      position: {
        x: round6(piece.position.x + d.x * t),
        y: round6(piece.position.y + d.y * t),
        z: round6(piece.position.z + d.z * t),
      },
    }));
  }).flat();
  return {
    cmds: copies.map((piece): PlanCommand => ({ type: 'raw.insert', piece })),
    items: copies.map((piece): SelectionItem => ({ kind: 'raw', id: piece.id })),
  };
};

/** "Repeat 4 pieces ×5". */
export const repeatLabel = (pieces: number, count: number): string =>
  `Repeat ${pieces} ${pieces === 1 ? 'piece' : 'pieces'} ×${count}`;
