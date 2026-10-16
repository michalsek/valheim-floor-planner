import type { Catalog } from '../catalog/pieceDefs';
import type { WallFamily } from '../catalog/wallFamilies';

import { computeBom, type Bom } from './bom';
import { findRooms, type Building, type PlanSummary, type Room, type RoomsResult } from './rooms';
import { splitWall, type SplitIssue, type SplitResult } from './splitWall';
import type { PlacedPiece, Plan, PlanWarning, WallRun } from './types';
import { buildWallGraph, overlapWarnings } from './wallGraph';

/** Everything computed from the plan; never stored. */
export interface Derived {
  pieces: PlacedPiece[];
  bom: Bom;
  warnings: PlanWarning[];
  rooms: Room[];
  buildings: Building[];
  summary: PlanSummary;
}

interface WallResult {
  family: WallFamily | undefined;
  pieces: PlacedPiece[];
  warnings: PlanWarning[];
}

// Plan objects are immutable, so an unchanged run keeps its split across edits.
const wallCache = new WeakMap<WallRun, WallResult>();

interface RoomsEntry extends RoomsResult {
  families: ReadonlyMap<string, WallFamily>;
  /** Overlapping and skipped (diagonal) segments. */
  warnings: PlanWarning[];
}

// Keyed by the walls record, so edits elsewhere (dimensions) keep the rooms.
const roomsCache = new WeakMap<Plan['walls'], RoomsEntry>();

const deriveRooms = (
  walls: Plan['walls'],
  families: ReadonlyMap<string, WallFamily>
): RoomsEntry => {
  const cached = roomsCache.get(walls);
  if (cached && cached.families === families) return cached;
  const graph = buildWallGraph(walls, families);
  const entry = {
    ...findRooms(graph),
    families,
    warnings: [...overlapWarnings(graph), ...graph.skipped],
  };
  roomsCache.set(walls, entry);
  return entry;
};

export const derivePlan = (
  plan: Plan,
  families: ReadonlyMap<string, WallFamily>,
  catalog: Catalog
): Derived => {
  const results = Object.values(plan.walls).map((wall) => deriveWall(wall, families));
  const pieces = results.flatMap((r) => r.pieces);
  const { rooms, buildings, summary, warnings } = deriveRooms(plan.walls, families);
  return {
    pieces,
    bom: computeBom(pieces, catalog),
    warnings: [...results.flatMap((r) => r.warnings), ...warnings],
    rooms,
    buildings,
    summary,
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
