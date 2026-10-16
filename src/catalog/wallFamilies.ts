/**
 * Wall families: a short hand-written list of which prefabs belong together, with
 * every number (lengths, heights, thickness, snap kind) derived from the catalogue.
 * See research/README.md §2 for panel (centre-line) vs block (face) walls.
 */
import { snapExtent, type Catalog, type PieceDef } from './pieceDefs';

export type SnapKind = 'centerline' | 'face';

export interface WallFamilySpec {
  id: string;
  label: string;
  pieces: readonly string[];
  openings: readonly string[];
}

export interface WallPieceDef {
  prefab: string;
  length: number;
  height: number;
  thickness: number;
}

export interface WallOpeningDef {
  prefab: string;
  width: number;
  height: number;
}

export interface WallFamily {
  id: string;
  label: string;
  /** Panel walls sit centred on the grid line; block walls put a face on it. */
  snapKind: SnapKind;
  /** The thickest piece's thickness, used for drawing the family. */
  thickness: number;
  material: string;
  /** Longest first, then tallest first. */
  pieces: WallPieceDef[];
  openings: WallOpeningDef[];
}

export const WALL_FAMILY_SPECS: readonly WallFamilySpec[] = [
  {
    id: 'wood',
    label: 'Wood',
    pieces: ['woodwall', 'wood_wall_half', 'wood_wall_quarter'],
    openings: ['wood_door', 'wood_gate'],
  },
  {
    id: 'log',
    label: 'Log',
    pieces: ['wood_wall_log_4x0.5', 'wood_wall_log'],
    openings: [],
  },
  {
    id: 'ashwood',
    label: 'Ashwood',
    pieces: ['ashwood_wall_2x2', 'ashwood_halfwall_1x2', 'ashwood_quarterwall_1x1'],
    openings: ['ashwood_door'],
  },
  {
    id: 'scalewood',
    label: 'Scalewood',
    pieces: ['scale_wall_2x2', 'scale_halfwall_1x2', 'scale_quarterwall_1x1'],
    openings: [],
  },
  { id: 'timber', label: 'Timber', pieces: ['stave_wall_2x2'], openings: ['stave_gate'] },
  {
    id: 'grausten',
    label: 'Grausten',
    pieces: ['Piece_grausten_wall_4x2', 'Piece_grausten_wall_2x2', 'Piece_grausten_wall_1x2'],
    openings: [],
  },
  {
    id: 'stone',
    label: 'Stone',
    pieces: ['stone_wall_4x2', 'stone_wall_2x1', 'stone_wall_1x1'],
    openings: [],
  },
];

const round2 = (n: number): number => Math.round(n * 100) / 100;
const SNAP_EPSILON = 0.01;

export const deriveWallFamilies = (
  catalog: Catalog,
  specs: readonly WallFamilySpec[]
): WallFamily[] => specs.map((spec) => deriveWallFamily(catalog, spec));

const deriveWallFamily = (catalog: Catalog, spec: WallFamilySpec): WallFamily => {
  const lookup = (prefab: string): PieceDef => {
    const piece = catalog.pieces.get(prefab);
    if (!piece) throw new Error(`Wall family "${spec.id}": unknown prefab "${prefab}"`);
    return piece;
  };
  const wallDefs = spec.pieces.map(lookup);
  const openingDefs = spec.openings.map(lookup);

  // Openings (e.g. timber's hardwood gate) may differ; the walls themselves may not.
  const materials = new Set(wallDefs.map((p) => p.material));
  const [material] = materials;
  if (materials.size !== 1 || !material) {
    throw new Error(`Wall family "${spec.id}": mixed or missing materials`);
  }

  const pieces = wallDefs
    .map(toWallPiece)
    .sort((a, b) => b.length - a.length || b.height - a.height);
  const thickness = Math.max(...pieces.map((p) => p.thickness));
  for (const p of pieces) {
    if (p.length <= 0 || p.height <= 0 || p.thickness <= 0) {
      throw new Error(`Wall family "${spec.id}": "${p.prefab}" has a zero or negative size`);
    }
  }

  return {
    id: spec.id,
    label: spec.label,
    snapKind: wallDefs.some(hasFaceSnapPoints) ? 'face' : 'centerline',
    thickness,
    material,
    pieces,
    openings: openingDefs.map(toOpening),
  };
};

const thicknessOf = (piece: PieceDef): number => round2(piece.colliderSize?.[2] ?? 0);

const toWallPiece = (piece: PieceDef): WallPieceDef => ({
  prefab: piece.prefab,
  length: round2(snapExtent(piece, 'x')),
  height: round2(snapExtent(piece, 'y')),
  thickness: thicknessOf(piece),
});

/** Block walls snap at their faces: some snap point sits half a thickness off-centre. */
const hasFaceSnapPoints = (piece: PieceDef): boolean => {
  const half = thicknessOf(piece) / 2;
  return (
    half > SNAP_EPSILON &&
    piece.snapPoints.some(([, , z]) => Math.abs(Math.abs(z) - half) < SNAP_EPSILON)
  );
};

/** An opening's size: its snap extents, or its collider where it has no snap points. */
export const toOpening = (piece: PieceDef): WallOpeningDef => ({
  prefab: piece.prefab,
  width: round2(snapExtent(piece, 'x') || (piece.colliderSize?.[0] ?? 0)),
  height: round2(snapExtent(piece, 'y') || (piece.colliderSize?.[1] ?? 0)),
});

/**
 * How far a wall's pieces sit off the drawn line, towards `side`: half the strip for
 * block walls (their face is on the line), none for panel walls (centred on it).
 */
export const stripOffset = (family: WallFamily): number =>
  family.snapKind === 'face' ? family.thickness / 2 : 0;

export const MAX_WALL_HEIGHT = 4;

/** The family's course height: its shortest piece. */
export const minPieceHeight = (family: WallFamily): number =>
  Math.min(...family.pieces.map((p) => p.height));

/**
 * Heights a family's walls can be drawn at: its smallest piece height, plus every
 * whole number of metres up to `MAX_WALL_HEIGHT` that is a multiple of it.
 */
export const wallHeightOptions = (family: WallFamily): number[] => {
  const min = minPieceHeight(family);
  const options = new Set([min]);
  for (let h = 1; h <= MAX_WALL_HEIGHT; h++) {
    const ratio = h / min;
    if (h >= min && Math.abs(ratio - Math.round(ratio)) < SNAP_EPSILON) options.add(h);
  }
  return [...options].sort((a, b) => a - b);
};

/** The valid height closest to `height`; a tie goes to the taller one. */
export const nearestWallHeight = (family: WallFamily, height: number): number =>
  wallHeightOptions(family).reduce((best, h) =>
    Math.abs(h - height) <= Math.abs(best - height) ? h : best
  );
