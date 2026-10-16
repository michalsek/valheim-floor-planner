import type { Library } from '../catalog/library';
import type { WallFamily } from '../catalog/wallFamilies';

import { computeBom, type Bom } from './bom';
import { deriveFloors, type FloorInfo } from './deriveFloors';
import { deriveWalls } from './deriveWalls';
import type { ResolvedOpening } from './openings';
import { findRooms, type Building, type PlanSummary, type Room, type RoomsResult } from './rooms';
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

// Keyed by the walls record, so edits elsewhere (dimensions, floors) keep the rooms.
// Rooms read runs, not pieces, so doors don't open rooms up.
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
  const rooms = deriveRooms(plan.walls, lib.wallFamilies);
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
