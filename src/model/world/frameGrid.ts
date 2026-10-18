/**
 * Which grid an imported plan's frame is on, and where its origin goes.
 *
 * - **World** (the default): the plan's axes are the world's (yaw 0, north up) and its
 *   origin is on the world's `WORLD_LATTICE`, so the plan's 0.5, 1 and 2 m grid lines
 *   fall on the game's terrain vertices (integer metres) and its zone edges (multiples
 *   of 64 m less 32: even metres). Buildings show at their true angles.
 * - **Build** ("Align grid to the build", the M13 frame): turned by the build's grid
 *   direction, the origin on the 0.5 m grid its pieces sit on, so an off-axis build's
 *   walls run along the plan's axes for the drawing tools.
 *
 * Either way the origin is the corner below and left of every footprint. Pure.
 */
import { propCorners } from '../geometry/propGeometry';
import { rawRect } from '../rawPieces';
import type { SiteFrame } from '../terrain/siteTerrain';
import type { Vec2 } from '../types';

import type { FramedPiece } from './framePieces';

export type FrameGrid = 'world' | 'build';

/** The grid imported builds are put on in a build frame (metres). */
export const GRID = 0.5;
/**
 * A world frame's origin is on this world lattice (metres): terrain vertices are at
 * every metre and zone edges at even metres, as are the plan's 2 m lines then.
 */
export const WORLD_LATTICE = 2;
/** Colliders may poke this far past the origin's grid line (they overhang their snaps). */
const OVERHANG = 0.05;

/** `v` modulo `GRID`, in [−GRID/2, GRID/2) around `centre`. */
const gridResidual = (v: number, centre: number): number =>
  ((((v - centre) % GRID) + 1.5 * GRID) % GRID) - GRID / 2;

/**
 * Where the grid lines of `values` fall modulo `GRID`: the most common centimetre, then
 * the mean of the values near it, as the game drifts a centimetre or two.
 */
export const gridOffset = (values: readonly number[]): number => {
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round((((v % GRID) + GRID) % GRID) * 100) % (GRID * 100);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let mode = 0;
  let bestCount = 0;
  for (const [key, count] of counts) if (count > bestCount) [mode, bestCount] = [key / 100, count];
  const near = values.map((v) => gridResidual(v, mode)).filter((r) => Math.abs(r) < 0.05);
  const mean = near.reduce((sum, r) => sum + r, 0) / Math.max(near.length, 1);
  return (((mode + mean) % GRID) + GRID) % GRID;
};

/** The highest grid line (shifted by `offset`) at or below `v`. */
export const gridFloor = (v: number, offset: number): number =>
  offset + Math.floor((v - offset) / GRID + 1e-6) * GRID;

/** The frame's yaw for a build whose grid direction is `buildYaw`. */
export const frameYaw = (grid: FrameGrid, buildYaw: number): number =>
  grid === 'build' ? buildYaw : 0;

/**
 * The plan origin for `turned` (pieces in a frame at the world's origin, turned by the
 * frame's yaw): below and left of every footprint, on the world lattice or on the grid
 * the pieces sit on.
 */
export const frameCorner = (
  turned: readonly Pick<FramedPiece, 'plan' | 'yaw' | 'def'>[],
  grid: FrameGrid
): Vec2 => {
  const corners = turned.flatMap((p) => propCorners(p.plan, p.yaw, rawRect(p.def)));
  const least = (axis: 'x' | 'z') => corners.reduce((m, c) => Math.min(m, c[axis]), Infinity);
  if (grid === 'world') {
    // Unturned, the frame's plan point (x, z) is world (x, −z): the lattice is the same.
    const floor = (v: number) => Math.floor(v / WORLD_LATTICE + 1e-9) * WORLD_LATTICE + 0;
    return { x: floor(least('x')), z: floor(least('z')) };
  }
  const square = turned.filter((p) => p.yaw % 90 === 0);
  const corner = (axis: 'x' | 'z') =>
    gridFloor(least(axis) + OVERHANG, gridOffset(square.map((p) => p.plan[axis])));
  return { x: corner('x'), z: corner('z') };
};

const onLattice = (v: number) => Math.abs(v / WORLD_LATTICE - Math.round(v / WORLD_LATTICE)) < 1e-6;

/**
 * The grid a frame is on: world axes when unturned with its origin on the lattice,
 * else its build's (every import before world frames, whatever its build's turn).
 */
export const frameGridOf = (frame: SiteFrame): FrameGrid =>
  frame.yaw === 0 && onLattice(frame.origin.x) && onLattice(frame.origin.z) ? 'world' : 'build';
