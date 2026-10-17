import type { Library } from '../catalog/library';
import type { WallFamily } from '../catalog/wallFamilies';

import { computeBom, type Bom } from './bom';
import { roundElevation } from './elevation';
import { deriveFloors, type FloorInfo } from './deriveFloors';
import { deriveWalls } from './deriveWalls';
import type { ResolvedOpening } from './openings';
import { findRooms, type Building, type PlanSummary, type Room, type RoomsResult } from './rooms';
import { levelPlan } from './levels';
import type { PlacedPiece, Plan, PlanWarning } from './types';
import { buildWallGraph, overlapWarnings } from './wallGraph';

/** Everything computed from the plan; never stored. */
export interface Derived {
  /** Wall, opening and floor pieces. */
  pieces: PlacedPiece[];
  bom: Bom;
  warnings: PlanWarning[];
  rooms: Room[];
  buildings: Building[];
  summary: PlanSummary;
  openings: ResolvedOpening[];
  floors: FloorInfo[];
}

interface RoomsEntry extends RoomsResult {
  families: ReadonlyMap<string, WallFamily>;
  /** Overlapping and skipped (diagonal) segments. */
  warnings: PlanWarning[];
}

// Keyed by one level's walls record (`levelPlan` keeps it while those walls don't
// change), so edits elsewhere keep the rooms. Rooms read runs, not pieces, so doors
// don't open rooms up.
const roomsCache = new WeakMap<Plan['walls'], RoomsEntry>();

/** Rooms, buildings and wall overlaps of walls that all stand at `elevation`. */
const deriveLevelRooms = (
  walls: Plan['walls'],
  elevation: number,
  families: ReadonlyMap<string, WallFamily>
): RoomsEntry => {
  const cached = roomsCache.get(walls);
  if (cached && cached.families === families) return cached;
  const graph = buildWallGraph(walls, families);
  const found = findRooms(graph);
  const entry = {
    ...found,
    rooms: found.rooms.map((room) => ({ ...room, key: `${elevation}:${room.key}` })),
    families,
    warnings: [...overlapWarnings(graph), ...graph.skipped],
  };
  roomsCache.set(walls, entry);
  return entry;
};

const sumSummaries = (summaries: readonly PlanSummary[]): PlanSummary => ({
  roomCount: summaries.reduce((n, s) => n + s.roomCount, 0),
  gridArea: summaries.reduce((n, s) => n + s.gridArea, 0),
  clearArea: summaries.reduce((n, s) => n + s.clearArea, 0),
  footprintArea: summaries.reduce((n, s) => n + s.footprintArea, 0),
});

/**
 * Rooms per level: walls at different elevations that cross on the plan neither close
 * a room nor overlap.
 */
const deriveRooms = (plan: Plan, lib: Library) => {
  const elevations = new Set(Object.values(plan.walls).map((w) => roundElevation(w.elevation)));
  const levels = [...elevations].map((e) =>
    deriveLevelRooms(levelPlan(plan, e, lib).walls, e, lib.wallFamilies)
  );
  return {
    rooms: levels.flatMap((l) => l.rooms),
    buildings: levels.flatMap((l) => l.buildings),
    summary: sumSummaries(levels.map((l) => l.summary)),
    warnings: levels.flatMap((l) => l.warnings),
  };
};

/** Props whose prefab isn't in the catalogue (from a hand-edited or newer file). */
const propWarnings = (plan: Plan, lib: Library): PlanWarning[] =>
  Object.values(plan.props).flatMap((prop): PlanWarning[] =>
    lib.propDefs.has(prop.prefab)
      ? []
      : [
          {
            source: { kind: 'prop', id: prop.id },
            segment: null,
            message: `Unknown item ${prop.prefab}`,
            level: 'warning',
          },
        ]
  );

export const derivePlan = (plan: Plan, lib: Library): Derived => {
  const walls = deriveWalls(plan, lib);
  const floors = deriveFloors(plan, lib);
  const rooms = deriveRooms(plan, lib);
  const pieces = [...floors.pieces, ...walls.pieces];
  return {
    pieces,
    bom: computeBom([...pieces, ...Object.values(plan.props)], lib.catalog),
    warnings: [
      ...walls.warnings,
      ...rooms.warnings,
      ...floors.warnings,
      ...propWarnings(plan, lib),
    ],
    rooms: rooms.rooms,
    buildings: rooms.buildings,
    summary: rooms.summary,
    openings: walls.openings,
    floors: floors.floors,
  };
};
