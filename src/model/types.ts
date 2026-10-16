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
}

export type DimId = string;

/** A pinned measurement from `a` to `b`, drawn `offset` metres to the right of a→b. */
export interface Dimension {
  id: DimId;
  a: Vec2;
  b: Vec2;
  /** Signed distance along `sideNormal(b − a, 'right')`. */
  offset: number;
}

export type FloorId = string;

/** A rectangle of floor tiles of one family, from `min` to `max` (x and z). */
export interface Floor {
  id: FloorId;
  familyId: string;
  min: Vec2;
  max: Vec2;
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

/** The plan document: everything the user draws, and the only thing in undo history. */
export interface Plan {
  version: 1;
  /** Shown in the plan header and used for the file name. */
  name: string;
  walls: Record<WallId, WallRun>;
  dimensions: Record<DimId, Dimension>;
  floors: Record<FloorId, Floor>;
  openings: Record<OpeningId, Opening>;
  props: Record<PropId, Prop>;
  underlay: Underlay | null;
}

export const DEFAULT_PLAN_NAME = 'Untitled';

export const emptyPlan = (): Plan => ({
  version: 1,
  name: DEFAULT_PLAN_NAME,
  walls: {},
  dimensions: {},
  floors: {},
  openings: {},
  props: {},
  underlay: null,
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
  /** Height of the piece's bottom edge above the ground, in metres. */
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
  /** 'info' notes something worth knowing that isn't wrong (a gate taller than its wall). */
  level: 'warning' | 'info';
}
