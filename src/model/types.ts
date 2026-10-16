/** A point or vector on the world plane, in metres. Screen right is +x, screen down is +z. */
export type Vec2 = { x: number; z: number };

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

/** The plan document: everything the user draws, and the only thing in undo history. */
export interface Plan {
  version: 1;
  walls: Record<WallId, WallRun>;
  dimensions: Record<DimId, Dimension>;
}

export const emptyPlan = (): Plan => ({ version: 1, walls: {}, dimensions: {} });

/** One game piece, derived from the plan (never stored). */
export interface PlacedPiece {
  /** Stable within a derive: `${sourceId}:${segment}:${course}:${n}`. */
  key: string;
  prefab: string;
  /** The prefab's material (e.g. 'wood', 'stone'); drives the plan colour. */
  material: string;
  /** Id of the plan object the piece was derived from. */
  sourceId: string;
  /** Index of the run segment the piece belongs to. */
  segment: number;
  /** Course index, counted in the family's smallest piece height. */
  course: number;
  /** Height of the piece's bottom edge above the ground, in metres. */
  base: number;
  height: number;
  center: Vec2;
  /** Angle of the piece's length axis on the plane: `atan2(dz, dx)`. */
  rotation: number;
  footprint: { length: number; thickness: number };
}

/** Pieces drawn on the plan: the bottom course (the bill of materials counts all). */
export const groundCourse = (pieces: readonly PlacedPiece[]): PlacedPiece[] =>
  pieces.filter((piece) => piece.course === 0);

export interface PlanWarning {
  wallId: WallId;
  segment: number | null;
  message: string;
}
