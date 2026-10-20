import type { SelectionItem } from './selection';

/** A point or vector on the world plane, in metres. Screen right is +x, screen down is +z. */
export type Vec2 = { x: number; z: number };

/** A point or size in 3D: x and z on the plan, y up (metres). */
export type Vec3 = { x: number; y: number; z: number };

export type DimId = string;

/** A pinned measurement from `a` to `b`, drawn `offset` metres to the right of a→b. */
export interface Dimension {
  id: DimId;
  a: Vec2;
  b: Vec2;
  /** Signed distance along `sideNormal(b − a, 'right')`. */
  offset: number;
  /** The height it is drawn at (metres, absolute). */
  elevation: number;
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
  /** The height of the surface it stands on (metres, absolute). */
  elevation: number;
}

export type RawPieceId = string;

/**
 * A single game piece (imported, built or exploded from an item): shown, counted,
 * moved and turned, but not reshaped.
 */
export interface RawPiece {
  id: RawPieceId;
  prefab: string;
  /** The prefab's pivot on the plan; `y` is its absolute height above the plan's 0 (metres). */
  position: Vec3;
  /**
   * Degrees. `yaw` turns clockwise on screen, like `Prop.rotation`, in [0, 360) (as the
   * game's yaw does seen from above, north up); `pitch` and `roll` are the game's Euler
   * x and z, for the odd tilted placement (`rawBoxes.ts` mirrors them).
   */
  rotation: { yaw: number; pitch: number; roll: number };
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
  /** The ground under the build (M16); null when imported without it. */
  terrain: SiteTerrain | null;
  /**
   * The world pieces the plan was given (`model/world/worldKeys.ts`), ascending: every
   * piece of each site imported, kept when pieces are deleted, so revealing sites never
   * imports one twice. Absent in plans imported before it (then found from the pieces).
   */
  worldPieces?: number[];
}

/**
 * The ground under an imported build (M16): the game's own 1 m vertex grid,
 * world-aligned, as the final ground (generated, then the save's terrain edits). The
 * seed is not stored: a plan file gets shared, and seed plus origin give the map away.
 */
export interface SiteTerrain {
  /** World coordinates (game axes, integers) of vertex (0, 0); rows run along world +z. */
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  /**
   * Centimetres above `ImportFrame.origin.y`, row-major (row = z); `terrainGrid` gives
   * metres. Never written in place: a new site is a new array. The autosave keeps it as
   * it is; a file packs it (`heightPacking.ts`); version 5 plans held base64.
   */
  heights: Int16Array;
  /**
   * Biome codes (the game's bitmask) at the zone corners over the patch, row-major,
   * corner (0, 0) at world (zx0 · 64 − 32, zz0 · 64 − 32).
   */
  biomes: { zx0: number; zz0: number; cols: number; rows: number; codes: number[] };
  /** The world generator's version (2). */
  worldGenVersion: number;
  /** The planner's generator revision that made it. */
  revision: number;
  notices: SiteNotices;
}

/** What the terrain may get wrong, shown with the Terrain toggle. */
export interface SiteNotices {
  /** Location centres (world x, z) near the patch: they flatten ground the save lacks. */
  locations: { x: number; z: number }[];
  /** Pre-1.0 terrain-edit pieces inside the patch (not applied). */
  legacyEdits: number;
  /** Zones whose saved terrain edits couldn't be read (another data version): not applied. */
  unreadEdits: number;
  /** The save's location heights near the site against the generator's. */
  check: { n: number; maxError: number };
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
 * Heights are absolute: a raw piece's pivot `y`, props and dimensions at their
 * `elevation`. What shows is cut at a session height (`cut.ts`).
 */
export interface Plan {
  version: 7;
  /** Shown in the plan header and used for the file name. */
  name: string;
  dimensions: Record<DimId, Dimension>;
  props: Record<PropId, Prop>;
  rawPieces: Record<RawPieceId, RawPiece>;
  underlay: Underlay | null;
  /** Set on a plan imported from a world save. */
  importFrame: ImportFrame | null;
}

export const DEFAULT_PLAN_NAME = 'Untitled';

export const emptyPlan = (): Plan => ({
  version: 7,
  name: DEFAULT_PLAN_NAME,
  dimensions: {},
  props: {},
  rawPieces: {},
  underlay: null,
  importFrame: null,
});

export interface PlanWarning {
  /** The plan object the warning is about. */
  source: SelectionItem;
  message: string;
}
