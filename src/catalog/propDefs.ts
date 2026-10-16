/**
 * Props: the non-building pieces placed as single footprints (stations, furniture,
 * misc, ships, stairs). Built from the catalogue; `propGroup` decides what is a prop.
 */
import type { Catalog, PieceDef } from './pieceDefs';

export type PropGroup = 'crafting' | 'furniture' | 'misc' | 'ships' | 'stairs';

export const PROP_GROUPS: readonly PropGroup[] = [
  'crafting',
  'furniture',
  'misc',
  'ships',
  'stairs',
];

export const GROUP_LABELS: Record<PropGroup, string> = {
  crafting: 'Crafting',
  furniture: 'Furniture',
  misc: 'Misc',
  ships: 'Ships',
  stairs: 'Stairs',
};

/** A footprint in the prefab's local space (metres, relative to its pivot). */
export interface LocalRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface PropDef {
  prefab: string;
  name: string;
  namePl: string;
  group: PropGroup;
  rect: LocalRect;
  /** The game data has no collider, so `rect` is a 1 × 1 stand-in. */
  approximate: boolean;
  comfort: number;
  /** Normalised EN name, PL name and prefab, for `filterProps`. */
  search: string;
}

/** The stand-in footprint for pieces without a collider (and unknown prefabs). */
export const APPROX_RECT: LocalRect = { minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 };

const SHIPS = new Set(['Raft', 'Karve', 'VikingShip', 'VikingShip_Ashlands']);

const STAIRS = new Set([
  'wood_stair',
  'ashwood_stair',
  'stone_stair',
  'blackmarble_stair',
  'piece_grausten_stonestair',
]);

const GROUP_BY_CATEGORY: Record<string, PropGroup> = {
  crafting: 'crafting',
  furniture: 'furniture',
  misc: 'misc',
};

/**
 * The prop group of a piece, or null when it isn't a prop: building pieces, structural
 * Deep North pieces (those with snap points) and the repair tool.
 */
export const propGroup = (piece: PieceDef): PropGroup | null => {
  if (SHIPS.has(piece.prefab)) return 'ships';
  if (STAIRS.has(piece.prefab)) return 'stairs';
  if (piece.category === 'deep-north') return piece.snapPoints.length === 0 ? 'furniture' : null;
  return GROUP_BY_CATEGORY[piece.category] ?? null;
};

/** Lower case, no diacritics (ł included, which NFD keeps), `_` as a space. */
export const normalizeSearch = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/_/g, ' ');

const rectOf = (piece: PieceDef): LocalRect | null => {
  if (!piece.colliderBounds) return null;
  const [min, max] = piece.colliderBounds;
  return { minX: min[0], maxX: max[0], minZ: min[2], maxZ: max[2] };
};

export const buildPropDefs = (catalog: Catalog): PropDef[] =>
  [...catalog.pieces.values()].flatMap((piece): PropDef[] => {
    const group = propGroup(piece);
    if (!group) return [];
    const rect = rectOf(piece);
    return [
      {
        prefab: piece.prefab,
        name: piece.name,
        namePl: piece.namePl,
        group,
        rect: rect ?? APPROX_RECT,
        approximate: rect === null,
        comfort: piece.comfort,
        search: normalizeSearch(`${piece.name} ${piece.namePl} ${piece.prefab}`),
      },
    ];
  });

/** The footprint of `prefab`; the stand-in for unknown ones. */
export const propRect = (defs: ReadonlyMap<string, PropDef>, prefab: string): LocalRect =>
  defs.get(prefab)?.rect ?? APPROX_RECT;

export const rectSize = (rect: LocalRect): { x: number; z: number } => ({
  x: rect.maxX - rect.minX,
  z: rect.maxZ - rect.minZ,
});

/**
 * The defs in `groups` (all when empty) whose search text has every query token; those
 * whose EN or PL name starts with the query come first, then by name.
 */
export const filterProps = (
  defs: readonly PropDef[],
  query: string,
  groups: ReadonlySet<PropGroup>
): PropDef[] => {
  const q = normalizeSearch(query).trim();
  const tokens = q.split(/\s+/).filter(Boolean);
  const startsWith = (d: PropDef) =>
    q !== '' && (normalizeSearch(d.name).startsWith(q) || normalizeSearch(d.namePl).startsWith(q));
  return defs
    .filter((d) => groups.size === 0 || groups.has(d.group))
    .filter((d) => tokens.every((t) => d.search.includes(t)))
    .map((d) => ({ d, first: startsWith(d) }))
    .sort((a, b) => Number(b.first) - Number(a.first) || a.d.name.localeCompare(b.d.name))
    .map(({ d }) => d);
};
