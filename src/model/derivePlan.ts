import type { Catalog } from '../catalog/pieceDefs';
import type { WallFamily } from '../catalog/wallFamilies';

import { computeBom, type Bom } from './bom';
import { splitWall, type SplitIssue, type SplitResult } from './splitWall';
import type { PlacedPiece, Plan, PlanWarning, WallRun } from './types';

/** Everything computed from the plan; never stored. */
export interface Derived {
  pieces: PlacedPiece[];
  bom: Bom;
  warnings: PlanWarning[];
}

interface WallResult {
  family: WallFamily | undefined;
  pieces: PlacedPiece[];
  warnings: PlanWarning[];
}

// Plan objects are immutable, so an unchanged run keeps its split across edits.
const wallCache = new WeakMap<WallRun, WallResult>();

export const derivePlan = (
  plan: Plan,
  families: ReadonlyMap<string, WallFamily>,
  catalog: Catalog
): Derived => {
  const results = Object.values(plan.walls).map((wall) => deriveWall(wall, families));
  const pieces = results.flatMap((r) => r.pieces);
  return {
    pieces,
    bom: computeBom(pieces, catalog),
    warnings: results.flatMap((r) => r.warnings),
  };
};

const deriveWall = (wall: WallRun, families: ReadonlyMap<string, WallFamily>): WallResult => {
  const family = families.get(wall.familyId);
  const cached = wallCache.get(wall);
  if (cached && cached.family === family) return cached;

  const result: WallResult = family
    ? { family, ...fromSplit(wall, splitWall(wall, family)) }
    : {
        family,
        pieces: [],
        warnings: [
          { wallId: wall.id, segment: null, message: `Unknown wall family "${wall.familyId}"` },
        ],
      };
  wallCache.set(wall, result);
  return result;
};

const issueMessage = (issue: SplitIssue): string =>
  issue.kind === 'unfilled'
    ? `Segment ${issue.segment + 1}: ${issue.area.toFixed(2)} m² can't be filled with whole pieces`
    : `Segment ${issue.segment + 1} is no longer than the wall is thick, so it has no pieces`;

const fromSplit = (wall: WallRun, split: SplitResult) => ({
  pieces: split.pieces,
  warnings: split.issues.map((issue) => ({
    wallId: wall.id,
    segment: issue.segment,
    message: issueMessage(issue),
  })),
});
