/**
 * Re-framing an imported plan: turning its grid between the world's axes and its
 * build's (`frameGrid.ts`) after the import. Every raw piece stays where it is in the
 * world; only the frame (origin and yaw) and so the pieces' plan positions and yaws
 * change. The datum (`origin.y`) and the levels stay, so the terrain, stored on the
 * world's vertex grid in heights above the datum, needs no change.
 *
 * Only a plan of raw pieces can be re-framed: drawn walls, floors, rooms, roofs and
 * props are laid out along the plan's axes, so turning them by a build's 22.5° would
 * take them off their own grids. Pure.
 */
import { normalizeDeg } from '../geometry/propGeometry';
import { planToWorld, worldToPlan, type SiteFrame } from '../terrain/siteTerrain';
import type { Plan, RawPiece, Vec3 } from '../types';

import type { FramedPiece, ImportLib } from './framePieces';
import { frameCorner, frameYaw, type FrameGrid } from './frameGrid';
import { dominantYaw } from './pieceCloud';

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;

/** How many drawn items (anything but raw pieces) a plan holds, an underlay counted. */
export const drawnItemCount = (plan: Plan): number =>
  Object.keys(plan.walls).length +
  Object.keys(plan.floors).length +
  Object.keys(plan.openings).length +
  Object.keys(plan.props).length +
  Object.keys(plan.roofs).length +
  Object.keys(plan.dimensions).length +
  (plan.underlay ? 1 : 0);

/** Why `plan` can't be re-framed; null when it can. */
export const reframeProblem = (plan: Plan): string | null => {
  if (!plan.importFrame) return 'Only an imported build has a world frame.';
  if (Object.keys(plan.rawPieces).length === 0) return 'The plan has no imported pieces.';
  const drawn = drawnItemCount(plan);
  if (drawn > 0) {
    return `Only a plan of imported pieces can turn its grid: this one has ${drawn} drawn ${drawn === 1 ? 'item' : 'items'} (walls, floors, roofs, props, dimensions or an underlay), which would be turned off their grid.`;
  }
  return null;
};

const builds = new WeakMap<Plan['rawPieces'], number>();

/**
 * The grid direction of the plan's build in the world (the yaw most of its raw pieces
 * share modulo 90°, as `WorldCluster.yaw`), once per piece set; 0 without a frame.
 */
export const planBuildYaw = (plan: Plan): number => {
  const frame = plan.importFrame;
  if (!frame) return 0;
  let yaw = builds.get(plan.rawPieces);
  if (yaw === undefined) {
    const yaws = Object.values(plan.rawPieces).map((p) => p.rotation.yaw + frame.yaw);
    builds.set(plan.rawPieces, (yaw = dominantYaw(yaws)));
  }
  return yaw;
};

/** A re-framed plan's new frame and pieces (the same ids), for `site.reframe`. */
export interface Reframe {
  origin: Vec3;
  yaw: number;
  pieces: RawPiece[];
}

/**
 * `plan` on `grid`: the frame an import on that grid would have given the same pieces
 * (origin below and left of every footprint, datum kept), and its pieces in it. Throws
 * when the plan can't be re-framed (`reframeProblem`).
 */
export const reframePlan = (plan: Plan, lib: ImportLib, grid: FrameGrid): Reframe => {
  const problem = reframeProblem(plan);
  if (problem) throw new Error(problem);
  const frame = plan.importFrame!;
  const raw = Object.values(plan.rawPieces);
  const yaw = frameYaw(grid, planBuildYaw(plan));
  // As an import does: first in a frame at the world's origin, turned by the new yaw.
  const zero: SiteFrame = { origin: { x: 0, y: 0, z: 0 }, yaw };
  const turned = raw.map((p): Pick<FramedPiece, 'plan' | 'yaw' | 'def'> => ({
    def: lib.catalog.pieces.get(p.prefab),
    plan: worldToPlan(zero, planToWorld(frame, p.position)),
    yaw: normalizeDeg(p.rotation.yaw + frame.yaw - yaw),
  }));
  const corner = frameCorner(turned, grid);
  const origin = planToWorld(zero, corner);
  const pieces = raw.map((p, k): RawPiece => ({
    ...p,
    position: {
      ...p.position,
      x: round6(turned[k]!.plan.x - corner.x),
      z: round6(turned[k]!.plan.z - corner.z),
    },
    rotation: { ...p.rotation, yaw: turned[k]!.yaw },
  }));
  return {
    origin: { x: round6(origin.x), y: frame.origin.y, z: round6(origin.z) },
    yaw,
    pieces,
  };
};
