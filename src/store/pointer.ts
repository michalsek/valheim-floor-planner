/**
 * The surface under the pointer (M18 §5.1), which every tool works on: no work plane.
 * In 3D the camera ray lands on the nearest drawn piece, the shown terrain or the ground
 * plane y = 0 (nothing over the sky); a side face or an underside drops to the surface
 * below. In 2D a ray comes straight down from `SKY_Y` and lands on the topmost drawn
 * surface (what 2D draws on top), else the ground, so 2D always has an answer. Only drawn
 * pieces are in the scene, so the cut needs no say in where the ray starts. Derived, not
 * stored, so it follows pans, orbits, cuts and commits without pointer movement.
 */
import { atom, useAtomValue, type Atom, type Getter } from 'jotai';
import { useMemo } from 'react';

import {
  buildHit,
  downHit,
  groundHeight,
  restingHit,
  SKY_Y,
  type BuildHit,
  type BuildScene,
} from '../model/build/buildHit';
import type { Ray3 } from '../model/geometry/ray';
import { snapToGrid } from '../model/geometry/snap';
import type { Plan, Vec2 } from '../model/types';
import { orbitTargetOf, planePointAt, pxPerMetreAt, screenRay } from '../viewport/projection3d';
import { screenToWorld, type ScreenPoint } from '../viewport/viewportMath';

import { committedPlanAtom } from './committedPlan';
import { getDrawnBoxes } from './planHooks';
import {
  cutHeightAtom,
  modifiersAtom,
  pointerScreenAtom,
  projection3dAtom,
  roofsVisibleAtom,
  snapStepAtom,
  terrainShownAtom,
  viewportAtom,
  viewportSizeAtom,
} from './session';
import { getSiteGround } from './siteTerrain';
import { viewModeAtom } from './view3d';

/** Hits further than this many orbit distances don't count (M10's far limit). */
const MAX_DISTANCES = 6;

export interface Cursor {
  /** The plan point under the pointer. */
  raw: Vec2;
  /** The snapped point, or the raw point while snapping is off (Alt held). */
  snapped: Vec2;
  snapping: boolean;
  /** The height of the surface under the pointer: on the ground, at `snapped`. */
  y: number;
  /** Whether that surface is a piece's or the ground (the terrain or the plane 0). */
  on: 'piece' | 'ground';
}

/**
 * The ray under a canvas point: the camera's in 3D (up to `MAX_DISTANCES` orbit
 * distances), straight down from `SKY_Y` in 2D.
 */
export const pointerRay = (
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
  return {
    ray: { origin: { x: p.x, y: SKY_Y, z: p.z }, dir: { x: 0, y: -1, z: 0 } },
    maxT: Infinity,
  };
};

/** What pointer rays land on in `plan`: its drawn boxes and the shown terrain. */
export const surfaceScene = (get: Getter, plan: Plan): BuildScene => {
  const site = get(terrainShownAtom) ? getSiteGround(plan) : null;
  return {
    boxes: getDrawnBoxes(plan, get(roofsVisibleAtom), get(cutHeightAtom)),
    terrain: site && { grid: site.grid, frame: site.frame },
  };
};

/**
 * What the ray under a canvas point lands on in `scene` (§5.1): in 3D the nearest
 * surface within reach (with `rest`, a side face or an underside drops to the surface
 * below: where a thing set down there stands), null when there is none; in 2D the
 * topmost surface from the sky, never null.
 */
export const pointerHit = (
  get: Getter,
  screen: ScreenPoint,
  scene: BuildScene,
  { rest }: { rest: boolean }
): BuildHit | null => {
  const pointer = pointerRay(get, screen);
  if (!pointer) return null;
  const { ray, maxT } = pointer;
  if (get(viewModeAtom) === '3d') return (rest ? restingHit : buildHit)(ray, { ...scene, maxT });
  return downHit({ x: ray.origin.x, z: ray.origin.z }, scene);
};

/** `raw` snapped as the cursor is (not while Alt is held). */
const snappedOf = (get: Getter, raw: Vec2): Pick<Cursor, 'snapped' | 'snapping'> => {
  const snapping = !get(modifiersAtom).alt;
  return { snapped: snapping ? snapToGrid(raw, get(snapStepAtom)) : raw, snapping };
};

/**
 * The pointer's cursor: where it is in plan, snapped, and the height of the surface
 * under it. Null without a pointer, and in 3D over the sky, beyond reach or under the
 * ground looking up.
 */
export const cursorAtom: Atom<Cursor | null> = atom((get) => {
  const screen = get(pointerScreenAtom);
  if (!screen) return null;
  const scene = surfaceScene(get, get(committedPlanAtom));
  const hit = pointerHit(get, screen, scene, { rest: true });
  if (!hit) return null;
  const raw = { x: hit.point.x, z: hit.point.z };
  const { snapped, snapping } = snappedOf(get, raw);
  const piece = hit.surface === 'piece';
  const y = piece ? hit.point.y : groundHeight(scene, snapped);
  return { raw, snapped, snapping, y, on: piece ? 'piece' : 'ground' };
});

/**
 * CSS px per metre where the pointer is: the zoom in 2D; in 3D, the scale at the
 * cursor's surface point (at the orbit target without a cursor). Screen tolerances go
 * through it.
 */
export const pxPerMetreAtom: Atom<number> = atom((get) => {
  const projection = get(projection3dAtom);
  if (get(viewModeAtom) !== '3d' || !projection) return get(viewportAtom).zoom;
  const cursor = get(cursorAtom);
  const at = cursor ? { x: cursor.raw.x, y: cursor.y, z: cursor.raw.z } : orbitTargetOf(projection);
  return pxPerMetreAt(at, projection);
});

/** Where the pointer is in plan, without the surface's height. */
export type PlaneCursor = Pick<Cursor, 'raw' | 'snapped' | 'snapping'>;

/**
 * The pointer on the horizontal plane at height `y`: in 3D where its ray meets that
 * plane, snapped (null when it misses); in 2D the cursor itself.
 */
const cursorOnPlane = (get: Getter, y: number): PlaneCursor | null => {
  const projection = get(projection3dAtom);
  const screen = get(pointerScreenAtom);
  if (get(viewModeAtom) !== '3d' || !projection) return get(cursorAtom);
  const raw = screen && planePointAt(screen, projection, y);
  return raw && { raw, ...snappedOf(get, raw) };
};

/**
 * The pointer on the plane at height `y`, for a dimension or ruler drawn there; a null
 * `y` is the cursor itself.
 */
export const useCursorOnPlane = (y: number | null): PlaneCursor | null =>
  useAtomValue(
    useMemo(() => (y === null ? cursorAtom : atom((get) => cursorOnPlane(get, y))), [y])
  );
