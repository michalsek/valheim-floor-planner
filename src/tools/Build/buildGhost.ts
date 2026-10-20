/**
 * The Build tool's ghost (M17 §3, §5, §6), derived from the pointer, the camera and the
 * build state, so it follows camera moves, cut changes and commits without pointer
 * events: ray → hit (grid on the ground) → base pose → snap → blocked, deep overlap and
 * the live support preview. Ctrl/⌘ swaps it for what a click would remove.
 */
import { atom, type Getter } from 'jotai';

import { buildHit, hitOnGrid, type BuildHit, type BuildScene } from '../../model/build/buildHit';
import {
  placeSet,
  setBoxes,
  setSnaps,
  type GhostSet,
  type GhostSnap,
  type PlacedGhost,
  type Pose,
} from '../../model/build/ghostSet';
import { deepOverlaps, type DeepOverlap } from '../../model/build/overlap';
import { basePose, blockedBy, snapPose, type SnapPair } from '../../model/build/placement';
import { boxBounds, boxesNear } from '../../model/build/snapPoints';
import type { Bounds3 } from '../../model/geometry/bounds3';
import { pickBoxes, type Ray3 } from '../../model/geometry/ray';
import type { PieceBox } from '../../model/pieceBoxes';
import type { Plan } from '../../model/types';
import { ghostSupport } from '../../model/support/ghostSupport';
import type { BoxSupport } from '../../model/support/planSupport';
import { getLibrary } from '../../store/libraryInstance';
import {
  modifiersAtom,
  pointerScreenAtom,
  projection3dAtom,
  snapStepAtom,
  viewportAtom,
  viewportSizeAtom,
  workPlaneAtom,
} from '../../store/session';
import { committedSupportIndex, latestSupportAtom } from '../../store/supportSync';
import { viewModeAtom } from '../../store/view3d';
import { screenRay } from '../../viewport/projection3d';
import { screenToWorld, type ScreenPoint } from '../../viewport/viewportMath';

import { armedSetAtom, buildYawAtom, manualSnapAtom, removeModeAtom } from './buildState';
import {
  buildTargets,
  buildTargetsAtom,
  committedPlanAtom,
  type BuildTargets,
} from './buildTargets';

/** Hits further than this many orbit distances don't count (M10's far limit). */
const MAX_DISTANCES = 6;
/** The 2D ray starts this far over the work plane. */
const RAY_2D_HEIGHT = 1000;

export interface BuildGhost {
  set: GhostSet;
  pose: Pose;
  placed: PlacedGhost[];
  /** The set's boxes at the pose (keys `raw:ghost<i>`, in set order). */
  boxes: PieceBox[];
  /** Its snap points at the pose, piece by piece in prefab order (the Q/E order). */
  snaps: GhostSnap[];
  /** The pair snapped together; null when nothing snapped. */
  pair: SnapPair | null;
  /** The manual snap point in use (null: auto). */
  manual: number | null;
  /** Shift or Alt: no snapping, no grid. */
  free: boolean;
  /** The piece it would duplicate: placing is blocked. */
  blockedBy: PieceBox | null;
  /** The deepest overlap of 0.5 m or more into another piece (advisory). */
  overlap: DeepOverlap | null;
  /** Each piece's support if placed now; null while the committed result is stale. */
  support: BoxSupport[] | null;
  /** Support is stale and the label says "checking…". */
  checking: boolean;
  /** Some pieces are hidden by the view and don't snap. */
  hidden: boolean;
}

/** The ray under a canvas point: the camera's in 3D, straight down onto the plane in 2D. */
const pointerRay = (
  get: Getter,
  screen: ScreenPoint | null
): { ray: Ray3; maxT: number } | null => {
  if (!screen) return null;
  if (get(viewModeAtom) === '3d') {
    const projection = get(projection3dAtom);
    if (!projection) return null;
    return {
      ray: screenRay(screen, projection),
      maxT: MAX_DISTANCES * projection.orbitDistance,
    };
  }
  const p = screenToWorld(get(viewportAtom), get(viewportSizeAtom), screen);
  const y = get(workPlaneAtom) + RAY_2D_HEIGHT;
  return { ray: { origin: { x: p.x, y, z: p.z }, dir: { x: 0, y: -1, z: 0 } }, maxT: Infinity };
};

/** What the Build ray may land on: in 2D the work plane only. */
const sceneOf = (get: Getter, targets: BuildTargets, maxT: number): BuildScene => {
  const in3d = get(viewModeAtom) === '3d';
  return {
    boxes: in3d ? targets.boxes : [],
    terrain: targets.terrain,
    datum: get(workPlaneAtom),
    maxT,
  };
};

const unionBounds = (boxes: readonly PieceBox[]): Bounds3 => {
  const all = boxes.map(boxBounds);
  const pick = (f: (a: number, b: number) => number, side: 'min' | 'max', axis: 'x' | 'y' | 'z') =>
    all.reduce((v, b) => f(v, b[side][axis]), all[0]![side][axis]);
  return {
    min: {
      x: pick(Math.min, 'min', 'x'),
      y: pick(Math.min, 'min', 'y'),
      z: pick(Math.min, 'min', 'z'),
    },
    max: {
      x: pick(Math.max, 'max', 'x'),
      y: pick(Math.max, 'max', 'y'),
      z: pick(Math.max, 'max', 'z'),
    },
  };
};

const deepest = (overlaps: readonly DeepOverlap[]): DeepOverlap | null =>
  overlaps.reduce<DeepOverlap | null>((a, b) => (a && a.depth >= b.depth ? a : b), null);

/** Where the ray lands, moved onto the grid on the ground unless placing freely. */
const landing = (
  get: Getter,
  screen: ScreenPoint,
  targets: BuildTargets,
  free: boolean
): BuildHit | null => {
  const pointer = pointerRay(get, screen);
  if (!pointer) return null;
  const scene = sceneOf(get, targets, pointer.maxT);
  const hit = buildHit(pointer.ray, scene);
  if (!hit || free) return hit;
  return hitOnGrid(hit, get(snapStepAtom), scene);
};

/** What to place, and where the pointer is: the Build tool's armed set, or a carried one. */
export interface GhostRequest {
  set: GhostSet;
  /** The set's turn (degrees, clockwise). */
  yaw: number;
  manual: number | null;
  /** Shift or Alt: no snapping, no grid. */
  free: boolean;
  screen: ScreenPoint;
  /** The committed plan. */
  plan: Plan;
  /** The carried pieces' box keys: left out of hits, snaps, duplicates and support. */
  exclude?: ReadonlySet<string> | null;
  /** While the committed support is stale, say "checking…" (else leave support out). */
  awaitSupport?: boolean;
}

/**
 * The ghost of a set under a canvas point (M17 §3): the ray's landing, the base pose,
 * the snap, then blocked, deep overlap and the support preview. Reads the view through
 * `get`, so a derived atom and a tool (`ctx.get`) both use it.
 */
export const ghostFor = (get: Getter, request: GhostRequest): BuildGhost | null => {
  const { set, yaw, manual, free, screen, plan, exclude = null } = request;
  const targets = buildTargets(get, plan, exclude);
  const hit = landing(get, screen, targets, free);
  if (!hit) return null;
  const lib = getLibrary();
  const base = basePose(hit, set, yaw, manual, lib);
  const { pose, pair } = snapPose(base, set, targets.index, { lib, manual, free });
  const placed = placeSet(set, pose);
  const boxes = setBoxes(set, pose, lib);
  const near = boxesNear(targets.index, unionBounds(boxes));
  const latest = get(latestSupportAtom);
  const fresh = latest?.plan === plan;
  const support = fresh
    ? ghostSupport(boxes, committedSupportIndex(plan), latest.support, exclude ?? undefined)
    : null;
  return {
    set,
    pose,
    placed,
    boxes,
    snaps: setSnaps(set, pose, lib),
    pair,
    manual,
    free,
    blockedBy: blockedBy(placed, targets.index, lib),
    overlap: deepest(deepOverlaps(boxes, near)),
    support,
    checking: !fresh && (request.awaitSupport ?? false),
    hidden: targets.hidden,
  };
};

/** The ghost where a click would place the armed set; null with nothing armed or no hit. */
export const buildGhostAtom = atom<BuildGhost | null>((get) => {
  const set = get(armedSetAtom);
  const modifiers = get(modifiersAtom);
  const screen = get(pointerScreenAtom);
  if (!set || get(removeModeAtom) || !screen) return null;
  return ghostFor(get, {
    set,
    yaw: get(buildYawAtom),
    manual: get(manualSnapAtom),
    free: modifiers.shift || modifiers.alt,
    screen,
    plan: get(committedPlanAtom),
    awaitSupport: true,
  });
});

export interface BuildRemoval {
  /** The raw piece or prop under the pointer. */
  box: PieceBox;
}

/**
 * While Ctrl/⌘ is held, the piece a click would remove: the nearest drawn piece under the
 * pointer (in 2D, along a ray straight down: the topmost one shown).
 */
export const buildRemovalAtom = atom<BuildRemoval | null>((get) => {
  if (!get(removeModeAtom)) return null;
  const pointer = pointerRay(get, get(pointerScreenAtom));
  if (!pointer) return null;
  const found = pickBoxes(pointer.ray, get(buildTargetsAtom).boxes);
  if (!found || found.t > pointer.maxT) return null;
  return { box: found.box };
});

/** The 3D snap cross and drop line hide while a ghost or a removal target shows. */
export const buildHidesCursorAtom = atom(
  (get) => get(buildGhostAtom) !== null || get(buildRemovalAtom) !== null
);
