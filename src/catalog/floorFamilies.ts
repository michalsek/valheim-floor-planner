/**
 * Floor families: which square floor tiles belong together. Sizes and thickness come
 * from the catalogue (snap extents and collider height); see research/README.md §3.
 */
import { snapExtent, type Catalog, type PieceDef } from './pieceDefs';

export interface FloorFamilySpec {
  id: string;
  label: string;
  tiles: readonly string[];
}

export interface FloorTileDef {
  prefab: string;
  /** Edge length of the square tile, in metres. */
  size: number;
  thickness: number;
}

export interface FloorFamily {
  id: string;
  label: string;
  material: string;
  /** The thickest tile's thickness. */
  thickness: number;
  /** Largest first. */
  tiles: FloorTileDef[];
  /** The smallest tile size: rectangles narrower than this can't be tiled. */
  minTile: number;
}

export const FLOOR_FAMILY_SPECS: readonly FloorFamilySpec[] = [
  { id: 'wood', label: 'Wood', tiles: ['wood_floor', 'wood_floor_1x1'] },
  { id: 'ashwood', label: 'Ashwood', tiles: ['ashwood_floor_2x2', 'ashwood_floor_1x1'] },
  { id: 'stone', label: 'Stone', tiles: ['stone_floor_2x2'] },
  { id: 'blackmarble', label: 'Black marble', tiles: ['blackmarble_floor'] },
  {
    id: 'grausten',
    label: 'Grausten',
    tiles: ['Piece_grausten_floor_4x4', 'Piece_grausten_floor_2x2', 'Piece_grausten_floor_1x1'],
  },
  { id: 'cage', label: 'Cage', tiles: ['iron_floor_2x2', 'iron_floor_1x1_v2'] },
];

const round2 = (n: number): number => Math.round(n * 100) / 100;

const toTile = (familyId: string, piece: PieceDef): FloorTileDef => {
  const x = round2(snapExtent(piece, 'x'));
  const z = round2(snapExtent(piece, 'z'));
  if (x !== z) throw new Error(`Floor family "${familyId}": "${piece.prefab}" is not square`);
  if (x <= 0) throw new Error(`Floor family "${familyId}": "${piece.prefab}" has no size`);
  return { prefab: piece.prefab, size: x, thickness: round2(piece.colliderSize?.[1] ?? 0) };
};

const deriveFloorFamily = (catalog: Catalog, spec: FloorFamilySpec): FloorFamily => {
  const pieces = spec.tiles.map((prefab) => {
    const piece = catalog.pieces.get(prefab);
    if (!piece) throw new Error(`Floor family "${spec.id}": unknown prefab "${prefab}"`);
    return piece;
  });
  const materials = new Set(pieces.map((p) => p.material));
  const [material] = materials;
  if (materials.size !== 1 || !material) {
    throw new Error(`Floor family "${spec.id}": mixed or missing materials`);
  }
  const tiles = pieces.map((p) => toTile(spec.id, p)).sort((a, b) => b.size - a.size);
  return {
    id: spec.id,
    label: spec.label,
    material,
    thickness: Math.max(...tiles.map((t) => t.thickness)),
    tiles,
    minTile: Math.min(...tiles.map((t) => t.size)),
  };
};

export const deriveFloorFamilies = (
  catalog: Catalog,
  specs: readonly FloorFamilySpec[]
): FloorFamily[] => specs.map((spec) => deriveFloorFamily(catalog, spec));
