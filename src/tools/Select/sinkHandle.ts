/**
 * The 3D sink handle: a selection of raw pieces, items, wall runs and floors that rests
 * on the ground (some piece's bottom on the terrain, or on y = 0 without one) and that no
 * unselected piece holds (none rests on or is snapped to one) can be lowered into the
 * ground by dragging a vertical arrow over it, and raised back up until a piece is on
 * the ground again. It changes a raw piece's height off its level, or a drawn item's
 * elevation, within the usual limits; the depth snaps to the elevation step (0.1 m with
 * Shift). The whole selection moves together, so a stack sinks as one.
 */
import { boxBounds, boxSnapPoints, snapIndex, snapsNear } from '../../model/build/snapPoints';
import type { PlanCommand } from '../../model/commands';
import { MIN_ELEVATION } from '../../model/elevation';
import { convexHull } from '../../model/geometry/convex';
import { boxCorners } from '../../model/geometry/orient';
import type { PieceBox } from '../../model/pieceBoxes';
import { MAX_RAW_HEIGHT } from '../../model/rawPieces';
import type { Selection, SelectionItem } from '../../model/selection';
import { groundUnderOrEdge } from '../../model/terrain/siteTerrain';
import type { Plan, Vec3 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { getPieceBoxes } from '../../store/planHooks';
import { getSiteGround } from '../../store/siteTerrain';

/** A bottom this close above the ground (or lower) rests on it (metres). */
const ON_GROUND = 0.1;
/** Two snap points this close are joined (metres; `SNAP_JOINT`). */
const JOINED = 0.03;
/** The finer depth step with Shift (metres). */
export const FINE_STEP = 0.1;

const SINKABLE: ReadonlySet<SelectionItem['kind']> = new Set(['raw', 'prop', 'wall', 'floor']);

export interface SinkTarget {
  item: SelectionItem;
  /** How deep its base is in the ground (≤ 0 when sunk; a hair above when resting). */
  depth: number;
  /** It rests on the ground (or is sunk): it stops the way up. */
  grounded: boolean;
  /** Over the middle of its top: the handle goes over the first grounded one. */
  top: Vec3;
}

const sameItem = (a: SelectionItem, b: SelectionItem) => a.kind === b.kind && a.id === b.id;

/**
 * The height an item rests at: its lowest box bottom, or a floor's walking surface
 * (floors hang below their elevation).
 */
const baseOf = (plan: Plan, item: SelectionItem, boxes: readonly PieceBox[]): number =>
  item.kind === 'floor'
    ? (plan.floors[item.id]?.elevation ?? 0)
    : Math.min(...boxes.map((box) => boxBounds(box).min.y));

/** Whether another piece's top is under the item's base, within its footprint's bounds. */
const restsOnPiece = (boxes: readonly PieceBox[], others: readonly PieceBox[], base: number) => {
  const own = boxes.map(boxBounds);
  return others.some((other) => {
    const b = boxBounds(other);
    if (b.max.y < base - ON_GROUND || b.min.y > base - 0.01) return false;
    return own.some(
      (o) => o.min.x < b.max.x && o.max.x > b.min.x && o.min.z < b.max.z && o.max.z > b.min.z
    );
  });
};

/** Whether a raw piece or prop shares a snap point with a piece that isn't selected. */
const snappedToOther = (plan: Plan, boxes: readonly PieceBox[], selection: Selection) => {
  const lib = getLibrary();
  const index = snapIndex(getPieceBoxes(plan), lib);
  return boxes.some((box) =>
    boxSnapPoints(box, lib).some((p) =>
      snapsNear(index, p, JOINED).some((t) => {
        const other = index.boxes[t.box]!;
        return other.kind !== 'opening' && !selection.some((s) => sameItem(s, other.item));
      })
    )
  );
};

const cache = new WeakMap<Plan, WeakMap<Selection, SinkTarget[]>>();

/** One selected item as a target; null when an unselected piece holds it (or it can't sink). */
const targetOf = (
  plan: Plan,
  item: SelectionItem,
  selection: Selection,
  all: readonly PieceBox[],
  others: readonly PieceBox[]
): SinkTarget | null => {
  if (!SINKABLE.has(item.kind)) return null;
  const boxes = all.filter((box) => sameItem(box.item, item));
  if (boxes.length === 0) return null;
  const corners = boxes.flatMap((box) => boxCorners(box));
  const footprint = convexHull(corners.map((c) => ({ x: c.x, z: c.z })));
  const site = getSiteGround(plan);
  const ground = site ? groundUnderOrEdge(site.grid, site.frame, footprint) : 0;
  const base = baseOf(plan, item, boxes);
  if (restsOnPiece(boxes, others, base)) return null;
  if ((item.kind === 'raw' || item.kind === 'prop') && snappedToOther(plan, boxes, selection)) {
    return null;
  }
  const xs = corners.map((c) => c.x);
  const zs = corners.map((c) => c.z);
  const top = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: Math.max(...corners.map((c) => c.y)),
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
  const depth = base - ground;
  return { item, depth, grounded: depth <= ON_GROUND, top };
};

/**
 * The selected items the handle moves, a grounded one first (it gets the handle); empty
 * unless every selected item can sink, none is held by an unselected piece and one rests
 * on the ground.
 */
export const sinkTargets = (plan: Plan, selection: Selection): SinkTarget[] => {
  let byPlan = cache.get(plan);
  if (!byPlan) cache.set(plan, (byPlan = new WeakMap()));
  const cached = byPlan.get(selection);
  if (cached) return cached;
  const all = getPieceBoxes(plan);
  const others = all.filter((box) => !selection.some((s) => sameItem(s, box.item)));
  const targets: SinkTarget[] = [];
  for (const item of selection) {
    const target = targetOf(plan, item, selection, all, others);
    if (!target) {
      targets.length = 0;
      break;
    }
    targets.push(target);
  }
  const first = targets.findIndex((t) => t.grounded);
  const result = first < 0 ? [] : [targets[first]!, ...targets.filter((_, i) => i !== first)];
  byPlan.set(selection, result);
  return result;
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6 + 0;

/** An item lowered (negative) or raised by `shift` metres, within the limits. */
const shiftCommand = (plan: Plan, item: SelectionItem, shift: number): PlanCommand | null => {
  switch (item.kind) {
    case 'raw': {
      const piece = plan.rawPieces[item.id];
      if (!piece) return null;
      const min = Math.max(-MAX_RAW_HEIGHT, MIN_ELEVATION - piece.elevation);
      const y = round6(Math.max(min, piece.position.y + shift));
      return { type: 'raw.patch', id: item.id, changes: { position: { ...piece.position, y } } };
    }
    case 'prop':
    case 'wall':
    case 'floor': {
      const source =
        item.kind === 'prop'
          ? plan.props[item.id]
          : item.kind === 'wall'
            ? plan.walls[item.id]
            : plan.floors[item.id];
      if (!source) return null;
      const elevation = round6(Math.max(MIN_ELEVATION, source.elevation + shift));
      const type = `${item.kind}.patch` as const;
      return { type, id: item.id, changes: { elevation } } as PlanCommand;
    }
    default:
      return null;
  }
};

/** How far up the targets may go: until a grounded one is back on the ground. */
const maxRise = (targets: readonly SinkTarget[]): number =>
  Math.min(...targets.filter((t) => t.grounded).map((t) => Math.max(t.depth, 0) - t.depth));

/**
 * The targets moved together by dragging `metres` (negative: down): the first one's
 * depth on the step, never above where a grounded one meets the ground. The commands,
 * and the first one's new depth.
 */
export const sinkCommands = (
  plan: Plan,
  targets: readonly SinkTarget[],
  metres: number,
  step: number
): { cmds: PlanCommand[]; depth: number } => {
  const first = targets[0];
  if (!first) return { cmds: [], depth: 0 };
  const stepped = Math.round((first.depth + metres) / step) * step;
  const change = Math.min(stepped - first.depth, maxRise(targets));
  const cmds =
    Math.abs(change) < 1e-9 ? [] : targets.flatMap((t) => shiftCommand(plan, t.item, change) ?? []);
  return { cmds, depth: first.depth + change };
};

/** Where the handle goes: over the first target, at the top of the highest one. */
export const handleTop = (targets: readonly SinkTarget[]): Vec3 | null => {
  const first = targets[0];
  return first ? { ...first.top, y: Math.max(...targets.map((t) => t.top.y)) } : null;
};
