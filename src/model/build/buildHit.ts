/**
 * What a pointer ray lands on (M17 §3.1, M18 §5.1): the Build tool's ray and the
 * cursor's. The nearest of the drawn pieces, the shown terrain and, where no terrain lies
 * under it, the ground plane y = 0. Pieces give their face's or triangle's normal; the
 * terrain and the ground give straight up, as the game does for the ground. Pure.
 */
import { snapValue } from '../geometry/snap';
import { addVec3, pointOnRay, rayPieceHit, scaleVec3, type Ray3 } from '../geometry/ray';
import type { PieceBox } from '../pieceBoxes';
import { groundAt, type SiteFrame, type TerrainGrid } from '../terrain/siteTerrain';
import { rayTerrain } from '../terrain/terrainRay';
import type { Vec2, Vec3 } from '../types';

export type BuildSurface = 'piece' | 'terrain' | 'ground';

export interface BuildHit {
  point: Vec3;
  /** Unit normal of the surface hit, facing the ray (straight up on the ground). */
  normal: Vec3;
  /** Distance along the ray. */
  t: number;
  surface: BuildSurface;
  /** The piece hit; null on the ground. */
  box: PieceBox | null;
}

export interface BuildScene {
  /** The drawn pieces the ray may land on (the carried ones left out). */
  boxes: readonly PieceBox[];
  /** The shown terrain; null on a flat site (or with the terrain hidden). */
  terrain: { grid: TerrainGrid; frame: SiteFrame } | null;
  /** How far along the ray anything counts (metres); unlimited by default. */
  maxT?: number;
}

/** 2D rays start this high: over anything a plan holds. */
export const SKY_Y = 1000;

/** A hit whose normal points up less than this is a side face or an underside. */
export const UPWARD = 0.5;
/** A side face's drop starts this far off the face (metres), clear of its own piece. */
export const DROP_OFF = 0.01;

const UP: Vec3 = { x: 0, y: 1, z: 0 };
const DOWN: Vec3 = { x: 0, y: -1, z: 0 };

/** The ground's height under a plan point: the terrain where it lies, else 0. */
export const groundHeight = (scene: Pick<BuildScene, 'terrain'>, p: Vec2): number =>
  (scene.terrain && groundAt(scene.terrain.grid, scene.terrain.frame, p)) ?? 0;

/** Whether terrain lies under a plan point. */
const onTerrain = (scene: Pick<BuildScene, 'terrain'>, p: Vec2): boolean =>
  scene.terrain !== null && groundAt(scene.terrain.grid, scene.terrain.frame, p) !== null;

/**
 * Where the ray meets the ground plane y = 0 from above; null when it doesn't, or where
 * terrain lies under that point (the terrain is the ground there).
 */
const groundPlaneT = (r: Ray3, scene: BuildScene): number | null => {
  if (r.dir.y > -1e-12) return null;
  const t = -r.origin.y / r.dir.y;
  if (t < 0) return null;
  return onTerrain(scene, pointOnRay(r, t)) ? null : t;
};

/** The nearest of `boxes` along the ray, nearer than `reach`; null with none. */
const nearestPiece = (r: Ray3, boxes: readonly PieceBox[], reach: number): BuildHit | null => {
  let best: BuildHit | null = null;
  for (const box of boxes) {
    const hit = rayPieceHit(r, box);
    if (hit && hit.t < reach) {
      best = { ...hit, point: pointOnRay(r, hit.t), surface: 'piece', box };
      reach = hit.t;
    }
  }
  return best;
};

/** The nearest surface along the ray; null when it meets none within reach. */
export const buildHit = (r: Ray3, scene: BuildScene): BuildHit | null => {
  let reach = scene.maxT ?? Infinity;
  let best: BuildHit | null = null;
  const ground = groundPlaneT(r, scene);
  if (ground !== null && ground <= reach) {
    best = { t: ground, point: pointOnRay(r, ground), normal: UP, surface: 'ground', box: null };
    reach = ground;
  }
  const piece = nearestPiece(r, scene.boxes, reach);
  if (piece) {
    best = piece;
    reach = piece.t;
  }
  if (scene.terrain) {
    const hit = rayTerrain(r, scene.terrain.grid, scene.terrain.frame, reach);
    if (hit) best = { ...hit, normal: UP, surface: 'terrain', box: null };
  }
  return best;
};

/**
 * The hit moved onto the grid (x and z to `step`) when it is on the ground, its height
 * taken again there (M17 §2.8, a planner addition); a hit on a piece is kept.
 */
export const hitOnGrid = (hit: BuildHit, step: number, scene: BuildScene): BuildHit => {
  if (hit.surface === 'piece') return hit;
  const x = snapValue(hit.point.x, step);
  const z = snapValue(hit.point.z, step);
  return { ...hit, point: { x, y: groundHeight(scene, { x, z }), z } };
};

/** Straight down from `origin` over the scene, without the reach limit. */
const dropFrom = (origin: Vec3, scene: BuildScene): BuildHit | null =>
  buildHit({ origin, dir: DOWN }, { ...scene, maxT: Infinity });

/**
 * Where something set down along the ray rests: its hit, but from a side face or an
 * underside the surface below it (a bed aimed at a wall lands at the wall's foot). With
 * nothing below, the face hit.
 */
export const restingHit = (r: Ray3, scene: BuildScene): BuildHit | null => {
  const hit = buildHit(r, scene);
  if (!hit || hit.normal.y >= UPWARD) return hit;
  return dropFrom(addVec3(hit.point, scaleVec3(hit.normal, DROP_OFF)), scene) ?? hit;
};

/**
 * The surface under a plan point, looking straight down from `SKY_Y` (the 2D rule): the
 * topmost of the scene's pieces there, else the ground; never null.
 */
export const downHit = (p: Vec2, scene: BuildScene): BuildHit => {
  const y = groundHeight(scene, p);
  const ground: BuildHit = {
    point: { x: p.x, y, z: p.z },
    normal: UP,
    t: SKY_Y - y,
    surface: onTerrain(scene, p) ? 'terrain' : 'ground',
    box: null,
  };
  const down = { origin: { x: p.x, y: SKY_Y, z: p.z }, dir: DOWN };
  return nearestPiece(down, scene.boxes, ground.t) ?? ground;
};
