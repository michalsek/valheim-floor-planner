import type { GableWallsId, RoofPitch } from '../catalog/roofFamilies';

import type { SelectionItem } from './selection';

/** A point or vector on the world plane, in metres. Screen right is +x, screen down is +z. */
export type Vec2 = { x: number; z: number };

/** A point or size in 3D: x and z on the plan, y up (metres). */
export type Vec3 = { x: number; y: number; z: number };

export type WallId = string;

/**
 * Which side of the drawn line a block wall's 1 m strip goes, looking along the
 * drawing direction. For a loop drawn clockwise on screen, 'right' is inside.
 * Panel walls ignore it: they sit centred on the line.
 */
export type WallSide = 'left' | 'right';

/** A polyline of wall pieces of one family. A closed run does not repeat its first point. */
export interface WallRun {
  id: WallId;
  familyId: string;
  points: Vec2[];
  closed: boolean;
  side: WallSide;
  /** Wall height in metres. */
  height: number;
  /** The level the run stands on: the height of its bottom (metres). */
  elevation: number;
}

export type DimId = string;

/** A pinned measurement from `a` to `b`, drawn `offset` metres to the right of a→b. */
export interface Dimension {
  id: DimId;
  a: Vec2;
  b: Vec2;
  /** Signed distance along `sideNormal(b − a, 'right')`. */
  offset: number;
  /** The level it is drawn on (metres). */
  elevation: number;
}

export type FloorId = string;

/**
 * A rectangle of floor tiles of one family, from `min` to `max` (x and z). Its top is
 * at `elevation`; the tiles hang below it.
 */
export interface Floor {
  id: FloorId;
  familyId: string;
  min: Vec2;
  max: Vec2;
  elevation: number;
}

export type OpeningId = string;

/**
 * A door, gate or grate cut into a wall. `at` is its centre on the wall's drawn line:
 * a world point, not a segment index, so it survives normalisation, loop reversal and
 * renumbering (the segment is worked out on every derive, see `resolveOpenings`).
 */
export interface Opening {
  id: OpeningId;
  wallId: WallId;
  prefab: string;
  at: Vec2;
}

export type PropId = string;

/**
 * A placed prop (station, furniture, ship…). `position` is the prefab's pivot, where
 * the game centres its build or ward ring; the footprint is offset from it.
 */
export interface Prop {
  id: PropId;
  prefab: string;
  position: Vec2;
  /** Degrees, clockwise on screen, in [0, 360). */
  rotation: number;
  /** Station upgrades (extensions) counted towards the build radius. */
  upgrades: number;
  /** The level it stands on (metres). */
  elevation: number;
}

export type RoofId = string;

/** Gable and shed roofs need a rectangle; a hip roof takes any orthogonal ring. */
export type RoofKind = 'gable' | 'hip' | 'shed';

/** A side of a rectangle: its low or high x or z edge. */
export type RoofSide = '-x' | '+x' | '-z' | '+z';

/** How far the roof reaches past the walls (metres): 1 m is how the user builds. */
export type RoofOverhang = 0 | 1 | 2;

/**
 * A roof, stored as parameters; its pieces are derived (`roofs/`), like a wall's. The
 * roof plane passes through the top edge of the walls at the outline, so the eave sits
 * `k · eave` below the wall top.
 */
export interface Roof {
  id: RoofId;
  /** The level it belongs to (its walls' elevation). */
  elevation: number;
  /** The wall tops' height above `elevation`: the roof rests on them. */
  base: number;
  /** Clockwise orthogonal ring on the 1 m grid: the wall lines it covers. */
  outline: Vec2[];
  familyId: string;
  pitch: RoofPitch;
  kind: RoofKind;
  /** Gable: the axis the ridge runs along. Hip and shed roofs ignore it. */
  ridgeAxis: 'x' | 'z';
  /** A shed roof's low eave; the other kinds ignore it. */
  lowSide: RoofSide;
  /** `eave` past the eave walls (every wall of a hip roof), `gable` past the gable ends. */
  overhang: { eave: RoofOverhang; gable: RoofOverhang };
  /** Triangle walls filling each gable (gable roofs only). */
  gableWalls: 'none' | GableWallsId;
}

export type RawPieceId = string;

/**
 * A game piece the planner can't express as a run, floor, opening, roof or prop (an
 * imported world build): shown, counted, moved and turned, but not reshaped.
 */
export interface RawPiece {
  id: RawPieceId;
  prefab: string;
  /** The prefab's pivot on the plan; `y` is its height above `elevation` (metres). */
  position: Vec3;
  /**
   * Degrees. `yaw` turns clockwise on screen, like `Prop.rotation`, in [0, 360) (as the
   * game's yaw does seen from above, north up); `pitch` and `roll` are the game's Euler
   * x and z, for the odd tilted placement (`rawBoxes.ts` mirrors them).
   */
  rotation: { yaw: number; pitch: number; roll: number };
  /** The level it belongs to (metres). */
  elevation: number;
}

/**
 * Where an imported build came from. Plan point (x, z) turned clockwise on screen by
 * `yaw` is `u`; the world point is (origin.x + u.x, origin.z − u.z) (the planner mirrors
 * the game's z), and plan height y is world height `origin.y + y`. A plan yaw plus
 * `yaw` is the game's yaw. Kept for exporting back (a PlanBuild blueprint).
 */
export interface ImportFrame {
  worldName: string;
  /** World coordinates (the game's own axes). */
  origin: Vec3;
  /** Degrees, the game's yaw of the plan's x axis, in [0, 360). */
  yaw: number;
}

/**
 * A reference image under the plan. The image itself lives in IndexedDB under
 * `imageId` (and optionally in saved files); the plan holds where it goes.
 */
export interface Underlay {
  imageId: string;
  /** The image's file name. */
  name: string;
  pixelSize: { w: number; h: number };
  /** World position of the image's top-left corner. */
  origin: Vec2;
  metresPerPixel: number;
  opacity: number;
  locked: boolean;
}

/**
 * The plan document: everything the user draws, and the only thing in undo history.
 * Levels aren't stored: they are the distinct elevations of its objects (`levels.ts`).
 */
export interface Plan {
  version: 4;
  /** Shown in the plan header and used for the file name. */
  name: string;
  walls: Record<WallId, WallRun>;
  dimensions: Record<DimId, Dimension>;
  floors: Record<FloorId, Floor>;
  openings: Record<OpeningId, Opening>;
  props: Record<PropId, Prop>;
  roofs: Record<RoofId, Roof>;
  rawPieces: Record<RawPieceId, RawPiece>;
  underlay: Underlay | null;
  /** Set on a plan imported from a world save. */
  importFrame: ImportFrame | null;
}

export const DEFAULT_PLAN_NAME = 'Untitled';

export const emptyPlan = (): Plan => ({
  version: 4,
  name: DEFAULT_PLAN_NAME,
  walls: {},
  dimensions: {},
  floors: {},
  openings: {},
  props: {},
  roofs: {},
  rawPieces: {},
  underlay: null,
  importFrame: null,
});

/** One game piece, derived from the plan (never stored). */
export interface PlacedPiece {
  /** Stable within a derive: `${sourceId}:${segment}:${course}:${n}`. */
  key: string;
  kind: 'wall' | 'floor' | 'opening';
  prefab: string;
  /** The prefab's material (e.g. 'wood', 'stone'); drives the plan colour. */
  material: string;
  /** Id of the plan object the piece was derived from. */
  sourceId: string;
  /** Index of the run segment the piece belongs to (0 for floor tiles). */
  segment: number;
  /** Course index, counted in the family's smallest piece height. */
  course: number;
  /**
   * Height of the piece's bottom edge above its source's elevation, in metres: 0 and up
   * for wall courses and openings, −thickness for floor tiles (they hang below it).
   */
  base: number;
  height: number;
  center: Vec2;
  /** Angle of the piece's length axis on the plane: `atan2(dz, dx)`. */
  rotation: number;
  /** Size on the plane: along the length axis, and across it. */
  footprint: { length: number; thickness: number };
}

/** Pieces drawn on the plan: the bottom course (the bill of materials counts all). */
export const groundCourse = (pieces: readonly PlacedPiece[]): PlacedPiece[] =>
  pieces.filter((piece) => piece.course === 0);

export interface PlanWarning {
  /** The plan object the warning is about. */
  source: SelectionItem;
  /** The wall segment, for wall warnings. */
  segment: number | null;
  message: string;
  /** A few words for tight spots (a room's badge); the message is shown elsewhere. */
  short?: string;
  /** 'info' notes something worth knowing that isn't wrong (a gate taller than its wall). */
  level: 'warning' | 'info';
}
