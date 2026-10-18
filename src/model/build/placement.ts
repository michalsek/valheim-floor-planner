/**
 * Where the Build tool's ghost goes (M17 §3), ported from the game's
 * `Player.UpdatePlacementGhost` (research §1, "Placement and snapping"): a base pose from
 * the ray's hit, then a snap to the nearest pair of snap points, dropped when it would
 * land on a piece of the same prefab. Pure.
 */
import { FLOOR_FAMILY_SPECS } from '../../catalog/floorFamilies';
import { normalizeDeg } from '../geometry/propGeometry';
import { fromLocal, toLocal } from '../geometry/orient';
import { addVec3 as add, scaleVec3, subVec3 as sub } from '../geometry/ray';
import type { PieceDef } from '../../catalog/pieceDefs';
import type { PieceBox } from '../pieceBoxes';
import { FLOOR_LIFT } from '../rawBoxes';
import type { RawShapeLib } from '../rawShapes';
import type { Vec3 } from '../types';

import type { BuildHit } from './buildHit';
import {
  placeSet,
  setBoxes,
  setSnaps,
  type GhostSet,
  type GhostSnap,
  type PlacedGhost,
  type Pose,
} from './ghostSet';
import {
  boundsDistance,
  localSnaps,
  pivotsNear,
  snapsNear,
  type SnapIndex,
  type SnapLib,
  type SnapTarget,
} from './snapPoints';

/** A ghost snap point and a target this close snap (metres; the game's 0.5). */
export const SNAP_RADIUS = 0.5;
/** Pieces whose collider is this close to the ghost's pivot are targets (metres; the game's 10). */
export const TARGET_RADIUS = 10;
/** A piece of the same prefab with its pivot this close is a duplicate (metres; the game's 0.05). */
export const DUPLICATE_DISTANCE = 0.05;
/** A duplicate also turned within this blocks placing (degrees; planner). */
export const DUPLICATE_ANGLE = 10;
/** One turn step (degrees; the game's `m_placeRotationDegrees`). */
export const ROTATION_STEP = 22.5;
/** How far out along the normal the ghost is put to find its contact point (metres; the game's 50). */
const PUSH_OUT = 50;

const DEG = Math.PI / 180;

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The point of a (turned) box closest to `p`. */
const closestOnBox = (box: PieceBox, p: Vec3): Vec3 => {
  const l = toLocal(p, box);
  const clamp = (v: number, half: number) => Math.max(-half, Math.min(half, v));
  return fromLocal(
    { x: clamp(l.x, box.size.x / 2), y: clamp(l.y, box.size.y / 2), z: clamp(l.z, box.size.z / 2) },
    box
  );
};

/** Floor tiles, whose raw boxes are lifted 1 mm for drawing (`rawBoxes.ts`). */
const FLOOR_TILES: ReadonlySet<string> = new Set(FLOOR_FAMILY_SPECS.flatMap((spec) => spec.tiles));

/** A box as its collider is: a floor tile's drawing lift taken off, so it rests on the hit. */
const unlifted = (box: PieceBox): PieceBox =>
  box.prefab !== null && FLOOR_TILES.has(box.prefab)
    ? { ...box, center: { ...box.center, y: box.center.y - FLOOR_LIFT } }
    : box;

/** The manual snap point when it is in range; null for auto (the game resets out-of-range ones). */
const manualOf = (manual: number | null, count: number): number | null =>
  manual !== null && manual >= 0 && manual < count ? manual : null;

/**
 * The ghost set's pose before snapping, turned by `yaw` (degrees, clockwise):
 * - with a manual snap point (an index into `setSnaps`), that point sits on the hit;
 * - otherwise the set's colliders touch the hit, pushed out along its normal: the set is
 *   put 50 m out along the normal, and moved so its point closest to the hit lands on it.
 */
export const basePose = (
  hit: Pick<BuildHit, 'point' | 'normal'>,
  set: GhostSet,
  yaw: number,
  manual: number | null,
  lib: RawShapeLib
): Pose => {
  const p = hit.point;
  const snaps = setSnaps(set, { pivot: { x: 0, y: 0, z: 0 }, yaw }, lib);
  const m = manualOf(manual, snaps.length);
  if (m !== null) return { pivot: sub(p, snaps[m]!.point), yaw };
  const out = add(p, scaleVec3(hit.normal, PUSH_OUT));
  let nearest: Vec3 | null = null;
  for (const box of setBoxes(set, { pivot: out, yaw }, lib)) {
    const c = closestOnBox(unlifted(box), p);
    if (nearest === null || dist(c, p) < dist(nearest, p)) nearest = c;
  }
  return { pivot: nearest ? add(out, sub(p, nearest)) : p, yaw };
};

export interface SnapOptions {
  lib: RawShapeLib;
  /** Snap only this ghost snap point (an index into `setSnaps`); null for auto. */
  manual?: number | null;
  /** Free placement (Shift / Alt): no snapping. */
  free?: boolean;
  /** Boxes that aren't targets (e.g. the pieces being carried). */
  ignore?: (box: PieceBox) => boolean;
}

export interface SnapPair {
  ghost: GhostSnap;
  target: SnapTarget;
  /** The box the target snap point belongs to. */
  box: PieceBox;
  distance: number;
}

export interface SnapResult {
  pose: Pose;
  /** The pair snapped together; null when nothing snapped. */
  pair: SnapPair | null;
  /** A pair was found, but the snap was dropped as it would duplicate a piece. */
  dropped: boolean;
}

/** The nearest pair of a ghost snap point and a target within `SNAP_RADIUS`; a tie keeps the first. */
const nearestPair = (
  ghosts: readonly GhostSnap[],
  placed: readonly PlacedGhost[],
  index: SnapIndex,
  ignore: ((box: PieceBox) => boolean) | undefined
): SnapPair | null => {
  let best: SnapPair | null = null;
  for (const ghost of ghosts) {
    const pivot = placed[ghost.piece]!.pivot;
    for (const target of snapsNear(index, ghost.point, SNAP_RADIUS)) {
      const box = index.boxes[target.box]!;
      if (ignore?.(box) || boundsDistance(pivot, index.bounds[target.box]!) > TARGET_RADIUS)
        continue;
      const distance = dist(target.point, ghost.point);
      if (best === null || distance < best.distance) best = { ghost, target, box, distance };
    }
  }
  return best;
};

/**
 * The base pose snapped (M17 §3.4–3.5): the nearest pair of a ghost snap point (only the
 * manual one when set) and a target's snap point within 0.5 m, over targets within 10 m,
 * moves the set by their difference. The snap is dropped when a piece of the set would
 * then sit on the pivot of a piece of the same prefab (within 0.05 m, any turn).
 */
export const snapPose = (
  base: Pose,
  set: GhostSet,
  index: SnapIndex,
  { lib, manual = null, free = false, ignore }: SnapOptions
): SnapResult => {
  if (free) return { pose: base, pair: null, dropped: false };
  const ghosts = setSnaps(set, base, lib);
  const m = manualOf(manual, ghosts.length);
  const pair = nearestPair(m === null ? ghosts : [ghosts[m]!], placeSet(set, base), index, ignore);
  if (!pair) return { pose: base, pair: null, dropped: false };
  const pose = { pivot: add(base.pivot, sub(pair.target.point, pair.ghost.point)), yaw: base.yaw };
  if (duplicateOf(placeSet(set, pose), index, null, ignore)) {
    return { pose: base, pair: null, dropped: true };
  }
  return { pose, pair, dropped: false };
};

/** A box's yaw as a raw piece's (degrees, clockwise), from its model's turn. */
const boxYaw = (box: PieceBox): number => normalizeDeg(-(box.modelTurn?.y ?? box.rotationY) / DEG);

/** How far a snap point may miss its turned image and still count as symmetric (metres). */
const SYMMETRY = 0.01;

const turnPeriods = new WeakMap<object, number>();

/**
 * The smallest turn (90°, 180° or 360°) that maps the prefab's snap points onto
 * themselves about its pivot: a wall turned 180° on the same spot is the same wall.
 */
export const turnPeriod = (def: PieceDef | undefined): number => {
  if (!def) return 360;
  const cached = turnPeriods.get(def);
  if (cached !== undefined) return cached;
  const snaps = localSnaps(def);
  const maps = (turn: (p: Vec3) => Vec3) =>
    snaps.length > 0 && snaps.every((p) => snaps.some((q) => dist(q, turn(p)) <= SYMMETRY));
  const period = maps((p) => ({ x: -p.z, y: p.y, z: p.x }))
    ? 90
    : maps((p) => ({ x: -p.x, y: p.y, z: -p.z }))
      ? 180
      : 360;
  turnPeriods.set(def, period);
  return period;
};

/** Degrees between two turns of a piece that looks the same every `period` degrees. */
const turnBetween = (a: number, b: number, period: number): number => {
  const d = normalizeDeg(a - b) % period;
  return Math.min(d, period - d);
};

/**
 * The first drawn piece a placed piece would duplicate: same prefab, pivot within
 * `DUPLICATE_DISTANCE`, and (when `angle` is given) turned within `angle` degrees, a
 * symmetric piece's turns counted modulo its symmetry (with `lib`).
 */
export const duplicateOf = (
  placed: readonly PlacedGhost[],
  index: SnapIndex,
  angle: number | null,
  ignore?: (box: PieceBox) => boolean,
  lib?: SnapLib
): PieceBox | null => {
  for (const piece of placed) {
    for (const box of pivotsNear(index, piece.pivot, DUPLICATE_DISTANCE)) {
      if (box.prefab !== piece.prefab || ignore?.(box)) continue;
      if (angle === null) return box;
      const period = lib ? turnPeriod(lib.catalog.pieces.get(piece.prefab)) : 360;
      if (turnBetween(boxYaw(box), piece.rotation.yaw, period) <= angle) return box;
    }
  }
  return null;
};

/**
 * Whether placing is blocked (M17 §3.6, planner): a piece would duplicate one already
 * there, turned the same way (within `DUPLICATE_ANGLE`, up to its symmetry with `lib`).
 * Returns that piece's box.
 */
export const blockedBy = (
  placed: readonly PlacedGhost[],
  index: SnapIndex,
  lib?: SnapLib,
  ignore?: (box: PieceBox) => boolean
): PieceBox | null => duplicateOf(placed, index, DUPLICATE_ANGLE, ignore, lib);

/**
 * The next manual snap point (Q / E, the game's TabLeft / TabRight): null (auto), then
 * 0 … count − 1, wrapping both ways.
 */
export const stepManual = (manual: number | null, count: number, step: 1 | -1): number | null => {
  const at = manual === null || manual >= count ? -1 : manual;
  const next = ((at + 1 + step + (count + 1)) % (count + 1)) - 1;
  return next < 0 ? null : next;
};
