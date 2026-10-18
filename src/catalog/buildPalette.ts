/**
 * What the Build palette lists and how: every placeable catalogue piece, in the hammer's
 * categories, with material chips and a search over EN / PL names and prefabs. Pure data;
 * the panel and its glyphs live in `ui/BuildPalette`.
 */
import { snapExtent, type PieceDef } from './pieceDefs';
import { normalizeSearch } from './propDefs';

export type BuildCategory =
  'building' | 'heavy-building' | 'furniture' | 'crafting' | 'misc' | 'deep-north' | 'other';

/** The hammer's tabs, in its order (Recent comes first in the panel). */
export const BUILD_CATEGORIES: readonly BuildCategory[] = [
  'building',
  'heavy-building',
  'furniture',
  'crafting',
  'misc',
  'deep-north',
  'other',
];

export const CATEGORY_LABELS: Record<BuildCategory, string> = {
  building: 'Building',
  'heavy-building': 'Heavy building',
  furniture: 'Furniture',
  crafting: 'Crafting',
  misc: 'Misc',
  'deep-north': 'Deep North',
  other: 'Other',
};

export type BuildMaterial =
  'wood' | 'hardwood' | 'stone' | 'marble' | 'ashstone' | 'iron' | 'timberwood' | 'other';

/** The material chips, in order (keys are `PieceDef.material`, 'other' for the rest). */
export const BUILD_MATERIALS: readonly BuildMaterial[] = [
  'wood',
  'hardwood',
  'stone',
  'marble',
  'ashstone',
  'iron',
  'timberwood',
  'other',
];

export const MATERIAL_LABELS: Record<BuildMaterial, string> = {
  wood: 'Wood',
  hardwood: 'Core wood',
  stone: 'Stone',
  marble: 'Black marble',
  ashstone: 'Grausten',
  iron: 'Iron',
  timberwood: 'Timber',
  other: 'Other',
};

const has = <T extends string>(list: readonly T[], value: string | null): value is T =>
  value !== null && (list as readonly string[]).includes(value);

export const buildCategory = (def: PieceDef): BuildCategory =>
  has(BUILD_CATEGORIES, def.category) ? def.category : 'other';

export const buildMaterial = (def: PieceDef): BuildMaterial =>
  has(BUILD_MATERIALS, def.material) ? def.material : 'other';

/** Whether Build can place it: anything with a cost or a collider (not the repair tool). */
export const isPlaceable = (def: PieceDef): boolean =>
  def.resources.length > 0 || def.colliderBounds !== null;

/** Its snap size (the snap points' extents, metres); null without snap points. */
export const pieceSize = (def: PieceDef): { x: number; y: number; z: number } | null =>
  def.snapPoints.length === 0
    ? null
    : { x: snapExtent(def, 'x'), y: snapExtent(def, 'y'), z: snapExtent(def, 'z') };

const metres = (n: number): string => String(Math.round(n * 10) / 10);

/** "2 × 2 m" (a wall's length and height, a floor's sides); null without a snap size. */
export const pieceSizeLabel = (def: PieceDef): string | null => {
  const size = pieceSize(def);
  if (!size) return null;
  const sides = [size.x, size.y, size.z].filter((n) => n >= 0.05).map(metres);
  return sides.length === 0 ? null : `${sides.join(' × ')} m`;
};

/**
 * The placeable defs in `category` and `material` (null: any) whose EN name, PL name or
 * prefab has every query token. With a query, names starting with it come first;
 * otherwise the catalogue's (the hammer's) order stays.
 */
export const filterPieces = (
  defs: Iterable<PieceDef>,
  query: string,
  category: BuildCategory | null,
  material: BuildMaterial | null
): PieceDef[] => {
  const q = normalizeSearch(query).trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const found = [...defs].filter((def) => {
    if (!isPlaceable(def)) return false;
    if (category !== null && buildCategory(def) !== category) return false;
    if (material !== null && buildMaterial(def) !== material) return false;
    const text = normalizeSearch(`${def.name} ${def.namePl} ${def.prefab}`);
    return tokens.every((t) => text.includes(t));
  });
  if (q === '') return found;
  const first = (def: PieceDef) =>
    normalizeSearch(def.name).startsWith(q) || normalizeSearch(def.namePl).startsWith(q);
  return [...found.filter(first), ...found.filter((def) => !first(def))];
};
