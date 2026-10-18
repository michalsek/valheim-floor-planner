/** Plan edits. Every change to the plan document goes through one of these. */
import { produce } from 'immer';

import { elevationProblem } from './elevation';
import { samePoint } from './geometry/polyline';
import { normalizeDeg } from './geometry/propGeometry';
import { MAX_PROPS, propProblem } from './props';
import { MAX_RAW_PIECES, rawPieceProblem } from './rawPieces';
import type {
  Dimension,
  DimId,
  Floor,
  FloorId,
  Opening,
  OpeningId,
  Plan,
  Prop,
  PropId,
  RawPiece,
  RawPieceId,
  Roof,
  RoofId,
  SiteTerrain,
  Underlay,
  Vec3,
  WallId,
  WallRun,
} from './types';
import { roofProblem } from './roofs/roofCheck';
import { siteTerrainProblem } from './terrain/siteCheck';
import { underlayProblem } from './underlay';
import { reframeProblem } from './world/reframe';

export type PlanCommand =
  | { type: 'wall.insert'; wall: WallRun }
  | { type: 'wall.patch'; id: WallId; changes: Partial<Omit<WallRun, 'id'>> }
  | { type: 'wall.remove'; id: WallId }
  | { type: 'dimension.insert'; dimension: Dimension }
  | { type: 'dimension.patch'; id: DimId; changes: Partial<Omit<Dimension, 'id'>> }
  | { type: 'dimension.remove'; id: DimId }
  | { type: 'floor.insert'; floor: Floor }
  | { type: 'floor.patch'; id: FloorId; changes: Partial<Omit<Floor, 'id'>> }
  | { type: 'floor.remove'; id: FloorId }
  | { type: 'opening.insert'; opening: Opening }
  | { type: 'opening.patch'; id: OpeningId; changes: Partial<Omit<Opening, 'id'>> }
  | { type: 'opening.remove'; id: OpeningId }
  | { type: 'prop.insert'; prop: Prop }
  | { type: 'prop.patch'; id: PropId; changes: Partial<Omit<Prop, 'id'>> }
  | { type: 'prop.remove'; id: PropId }
  | { type: 'roof.insert'; roof: Roof }
  | { type: 'roof.patch'; id: RoofId; changes: Partial<Omit<Roof, 'id'>> }
  | { type: 'roof.remove'; id: RoofId }
  | { type: 'raw.insert'; piece: RawPiece }
  | { type: 'raw.patch'; id: RawPieceId; changes: Partial<Omit<RawPiece, 'id'>> }
  | { type: 'raw.remove'; id: RawPieceId }
  | { type: 'underlay.set'; underlay: Underlay | null }
  | { type: 'underlay.patch'; changes: Partial<Underlay> }
  /** Adds (or with null removes) the ground under an imported build. */
  | { type: 'site.setTerrain'; terrain: SiteTerrain | null }
  /**
   * Adds the pieces of sites the terrain revealed (`model/world/revealSites.ts`) and sets
   * the frame's `worldPieces` to the list that includes them.
   */
  | { type: 'site.reveal'; pieces: RawPiece[]; worldPieces: number[] }
  /**
   * Turns an imported plan's grid (`model/world/reframe.ts`): the frame's new origin and
   * yaw, and every raw piece (the same ids) in it. Only for a plan of raw pieces.
   */
  | { type: 'site.reframe'; origin: Vec3; yaw: number; pieces: RawPiece[] }
  | { type: 'plan.rename'; name: string }
  | { type: 'plan.replace'; plan: Plan };

/** The history label a command gets unless the caller names the gesture. */
export const COMMAND_LABELS: Record<PlanCommand['type'], string> = {
  'wall.insert': 'Add wall',
  'wall.patch': 'Edit wall',
  'wall.remove': 'Delete wall',
  'dimension.insert': 'Add dimension',
  'dimension.patch': 'Edit dimension',
  'dimension.remove': 'Delete dimension',
  'floor.insert': 'Add floor',
  'floor.patch': 'Edit floor',
  'floor.remove': 'Delete floor',
  'opening.insert': 'Add opening',
  'opening.patch': 'Edit opening',
  'opening.remove': 'Delete opening',
  'prop.insert': 'Add item',
  'prop.patch': 'Edit item',
  'prop.remove': 'Delete item',
  'roof.insert': 'Add roof',
  'roof.patch': 'Edit roof',
  'roof.remove': 'Delete roof',
  'raw.insert': 'Add piece',
  'raw.patch': 'Edit piece',
  'raw.remove': 'Delete piece',
  'underlay.set': 'Set underlay',
  'underlay.patch': 'Edit underlay',
  'site.setTerrain': 'Set terrain',
  'site.reveal': 'Reveal sites',
  'site.reframe': 'Turn the grid',
  'plan.rename': 'Rename plan',
  'plan.replace': 'Replace plan',
};

export class PlanCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanCommandError';
  }
}

// Commands accept only what `parsePlan` loads, so the autosave always reads back.
const checkElevation = ({ elevation }: { elevation: number }): void => {
  const problem = elevationProblem(elevation);
  if (problem) throw new PlanCommandError(`Invalid elevation: ${problem}`);
};

const checkFloor = (floor: Floor): void => {
  const { min, max } = floor;
  if (!(max.x > min.x && max.z > min.z)) throw new PlanCommandError('A floor needs an area');
  checkElevation(floor);
};

const checkWall = (plan: Plan, wallId: WallId): void => {
  if (!(wallId in plan.walls)) throw new PlanCommandError(`Wall "${wallId}" does not exist`);
};

const checkProp = (prop: Prop): void => {
  const problem = propProblem(prop);
  if (problem) throw new PlanCommandError(`Invalid item: ${problem}`);
  checkElevation(prop);
};

const checkRoof = (roof: Roof): void => {
  const problem = roofProblem(roof);
  if (problem) throw new PlanCommandError(`Invalid roof: ${problem}`);
};

const checkRawPiece = (piece: RawPiece): void => {
  const problem = rawPieceProblem(piece);
  if (problem) throw new PlanCommandError(`Invalid piece: ${problem}`);
};

/** The rotation with its yaw in [0, 360), as parsing stores it. */
const normalYaw = (rotation: RawPiece['rotation']): RawPiece['rotation'] => ({
  ...rotation,
  yaw: normalizeDeg(rotation.yaw),
});

const checkDimension = (dim: Dimension): void => {
  if (samePoint(dim.a, dim.b)) throw new PlanCommandError('A dimension needs two different points');
  checkElevation(dim);
};

const checkUnderlay = (underlay: Underlay): void => {
  const problem = underlayProblem(underlay);
  if (problem) throw new PlanCommandError(`Invalid underlay: ${problem}`);
};

/**
 * Applies `cmd` to an Immer draft. `plan.replace` returns the new plan instead, which
 * Immer takes as the recipe's result.
 */
export const applyCommand = (draft: Plan, cmd: PlanCommand): Plan | undefined => {
  switch (cmd.type) {
    case 'wall.insert':
      if (cmd.wall.id in draft.walls) {
        throw new PlanCommandError(`Wall "${cmd.wall.id}" already exists`);
      }
      checkElevation(cmd.wall);
      draft.walls[cmd.wall.id] = cmd.wall;
      return undefined;
    case 'wall.patch': {
      const wall = draft.walls[cmd.id];
      if (!wall) throw new PlanCommandError(`Wall "${cmd.id}" does not exist`);
      Object.assign(wall, cmd.changes);
      checkElevation(wall);
      return undefined;
    }
    case 'wall.remove':
      if (!(cmd.id in draft.walls)) throw new PlanCommandError(`Wall "${cmd.id}" does not exist`);
      delete draft.walls[cmd.id];
      // A wall takes its openings with it; one undo restores both.
      for (const opening of Object.values(draft.openings)) {
        if (opening.wallId === cmd.id) delete draft.openings[opening.id];
      }
      return undefined;
    case 'dimension.insert':
      if (cmd.dimension.id in draft.dimensions) {
        throw new PlanCommandError(`Dimension "${cmd.dimension.id}" already exists`);
      }
      checkDimension(cmd.dimension);
      draft.dimensions[cmd.dimension.id] = cmd.dimension;
      return undefined;
    case 'dimension.patch': {
      const dim = draft.dimensions[cmd.id];
      if (!dim) throw new PlanCommandError(`Dimension "${cmd.id}" does not exist`);
      Object.assign(dim, cmd.changes);
      checkDimension(dim);
      return undefined;
    }
    case 'dimension.remove':
      if (!(cmd.id in draft.dimensions)) {
        throw new PlanCommandError(`Dimension "${cmd.id}" does not exist`);
      }
      delete draft.dimensions[cmd.id];
      return undefined;
    case 'floor.insert':
      if (cmd.floor.id in draft.floors) {
        throw new PlanCommandError(`Floor "${cmd.floor.id}" already exists`);
      }
      checkFloor(cmd.floor);
      draft.floors[cmd.floor.id] = cmd.floor;
      return undefined;
    case 'floor.patch': {
      const floor = draft.floors[cmd.id];
      if (!floor) throw new PlanCommandError(`Floor "${cmd.id}" does not exist`);
      Object.assign(floor, cmd.changes);
      checkFloor(floor);
      return undefined;
    }
    case 'floor.remove':
      if (!(cmd.id in draft.floors)) throw new PlanCommandError(`Floor "${cmd.id}" does not exist`);
      delete draft.floors[cmd.id];
      return undefined;
    case 'opening.insert':
      if (cmd.opening.id in draft.openings) {
        throw new PlanCommandError(`Opening "${cmd.opening.id}" already exists`);
      }
      checkWall(draft, cmd.opening.wallId);
      draft.openings[cmd.opening.id] = cmd.opening;
      return undefined;
    case 'opening.patch': {
      const opening = draft.openings[cmd.id];
      if (!opening) throw new PlanCommandError(`Opening "${cmd.id}" does not exist`);
      Object.assign(opening, cmd.changes);
      checkWall(draft, opening.wallId);
      return undefined;
    }
    case 'opening.remove':
      if (!(cmd.id in draft.openings)) {
        throw new PlanCommandError(`Opening "${cmd.id}" does not exist`);
      }
      delete draft.openings[cmd.id];
      return undefined;
    case 'prop.insert':
      if (cmd.prop.id in draft.props) {
        throw new PlanCommandError(`Item "${cmd.prop.id}" already exists`);
      }
      if (Object.keys(draft.props).length >= MAX_PROPS) {
        throw new PlanCommandError(`A plan holds at most ${MAX_PROPS} items`);
      }
      checkProp(cmd.prop);
      draft.props[cmd.prop.id] = cmd.prop;
      return undefined;
    case 'prop.patch': {
      const prop = draft.props[cmd.id];
      if (!prop) throw new PlanCommandError(`Item "${cmd.id}" does not exist`);
      Object.assign(prop, cmd.changes);
      checkProp(prop);
      return undefined;
    }
    case 'prop.remove':
      if (!(cmd.id in draft.props)) throw new PlanCommandError(`Item "${cmd.id}" does not exist`);
      delete draft.props[cmd.id];
      return undefined;
    case 'roof.insert':
      if (cmd.roof.id in draft.roofs) {
        throw new PlanCommandError(`Roof "${cmd.roof.id}" already exists`);
      }
      checkRoof(cmd.roof);
      draft.roofs[cmd.roof.id] = cmd.roof;
      return undefined;
    case 'roof.patch': {
      const roof = draft.roofs[cmd.id];
      if (!roof) throw new PlanCommandError(`Roof "${cmd.id}" does not exist`);
      Object.assign(roof, cmd.changes);
      checkRoof(roof);
      return undefined;
    }
    case 'roof.remove':
      if (!(cmd.id in draft.roofs)) throw new PlanCommandError(`Roof "${cmd.id}" does not exist`);
      delete draft.roofs[cmd.id];
      return undefined;
    case 'raw.insert':
      if (cmd.piece.id in draft.rawPieces) {
        throw new PlanCommandError(`Piece "${cmd.piece.id}" already exists`);
      }
      if (Object.keys(draft.rawPieces).length >= MAX_RAW_PIECES) {
        throw new PlanCommandError(`A plan holds at most ${MAX_RAW_PIECES} raw pieces`);
      }
      checkRawPiece(cmd.piece);
      draft.rawPieces[cmd.piece.id] = { ...cmd.piece, rotation: normalYaw(cmd.piece.rotation) };
      return undefined;
    case 'raw.patch': {
      const piece = draft.rawPieces[cmd.id];
      if (!piece) throw new PlanCommandError(`Piece "${cmd.id}" does not exist`);
      Object.assign(piece, cmd.changes);
      checkRawPiece(piece);
      if (cmd.changes.rotation) piece.rotation = normalYaw(piece.rotation);
      return undefined;
    }
    case 'raw.remove':
      if (!(cmd.id in draft.rawPieces)) {
        throw new PlanCommandError(`Piece "${cmd.id}" does not exist`);
      }
      delete draft.rawPieces[cmd.id];
      return undefined;
    case 'underlay.set':
      if (cmd.underlay) checkUnderlay(cmd.underlay);
      draft.underlay = cmd.underlay;
      return undefined;
    case 'underlay.patch':
      if (!draft.underlay) throw new PlanCommandError('There is no underlay');
      Object.assign(draft.underlay, cmd.changes);
      checkUnderlay(draft.underlay);
      return undefined;
    case 'site.setTerrain': {
      if (!draft.importFrame) throw new PlanCommandError('Only an imported build has terrain');
      const problem = cmd.terrain && siteTerrainProblem(cmd.terrain);
      if (problem) throw new PlanCommandError(`Invalid terrain: ${problem}`);
      draft.importFrame.terrain = cmd.terrain;
      return undefined;
    }
    case 'site.reveal': {
      if (!draft.importFrame) throw new PlanCommandError('Only an imported build reveals sites');
      if (Object.keys(draft.rawPieces).length + cmd.pieces.length > MAX_RAW_PIECES) {
        throw new PlanCommandError(`A plan holds at most ${MAX_RAW_PIECES} raw pieces`);
      }
      for (const piece of cmd.pieces) {
        if (piece.id in draft.rawPieces) {
          throw new PlanCommandError(`Piece "${piece.id}" already exists`);
        }
        checkRawPiece(piece);
        draft.rawPieces[piece.id] = { ...piece, rotation: normalYaw(piece.rotation) };
      }
      draft.importFrame.worldPieces = cmd.worldPieces;
      return undefined;
    }
    case 'site.reframe': {
      const problem = reframeProblem(draft);
      if (problem) throw new PlanCommandError(problem);
      const ids = Object.keys(draft.rawPieces);
      if (
        cmd.pieces.length !== ids.length ||
        cmd.pieces.some((piece) => !(piece.id in draft.rawPieces))
      ) {
        throw new PlanCommandError('A new frame must hold the same pieces');
      }
      const yaw = normalizeDeg(cmd.yaw);
      if (![cmd.origin.x, cmd.origin.y, cmd.origin.z].every(Number.isFinite)) {
        throw new PlanCommandError('A frame needs a finite origin');
      }
      for (const piece of cmd.pieces) {
        checkRawPiece(piece);
        draft.rawPieces[piece.id] = { ...piece, rotation: normalYaw(piece.rotation) };
      }
      draft.importFrame!.origin = cmd.origin;
      draft.importFrame!.yaw = yaw;
      return undefined;
    }
    case 'plan.rename': {
      const name = cmd.name.trim();
      if (!name) throw new PlanCommandError('A plan needs a name');
      draft.name = name;
      return undefined;
    }
    case 'plan.replace':
      return cmd.plan;
    default: {
      const unknown: never = cmd;
      throw new PlanCommandError(`Unknown command ${JSON.stringify(unknown)}`);
    }
  }
};

/**
 * `plan` with `cmds` applied in order, outside history (for previews). Each command
 * gets its own Immer step, so `plan.replace` works and unchanged objects are shared.
 */
export const applyCommands = (plan: Plan, cmds: readonly PlanCommand[]): Plan =>
  cmds.reduce((current, cmd) => produce(current, (draft) => applyCommand(draft, cmd)), plan);
