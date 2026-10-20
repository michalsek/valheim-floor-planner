/**
 * Props: the pieces placed as single footprints (stations, furniture, misc, ships,
 * stairs and ladders, and the poles, beams and pillars stilts are built from). Built from
 * the catalogue; `propGroup` decides what is a prop.
 */
import { snapExtent, type Catalog, type PieceDef } from './pieceDefs';

export type PropGroup = 'crafting' | 'furniture' | 'misc' | 'ships' | 'stairs' | 'structure';

export const PROP_GROUPS: readonly PropGroup[] = [
  'crafting',
  'furniture',
  'misc',
  'ships',
  'stairs',
  'structure',
];

export const GROUP_LABELS: Record<PropGroup, string> = {
  crafting: 'Crafting',
  furniture: 'Furniture',
  misc: 'Misc',
  ships: 'Ships',
  stairs: 'Stairs',
  structure: 'Poles & beams',
};

/**
 * Groups whose pieces stand on their elevation with their whole collider (a pole's
 * pivot is at its middle) and carry weight: they give support (`model/support`).
 */
export const LOAD_BEARING_GROUPS: ReadonlySet<PropGroup> = new Set(['stairs', 'structure']);

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
  /** The collider's height span above the pivot (metres); 0–1 when approximate. */
  heightRange: { minY: number; maxY: number };
  /** The game data has no collider, so `rect` (and `heightRange`) is a 1 × 1 stand-in. */
  approximate: boolean;
  comfort: number;
  /** Its material (support and colour); null when the game data has none. */
  material: string | null;
  /**
   * Stairs and ladders: how high one piece climbs and how far, and which way along local
   * z (`towards`: +1 or −1; +1 in planner space, which mirrors the game's −z; from its
   * snap points). Null for other props.
   */
  flight: { rise: number; run: number; towards: 1 | -1 } | null;
  /**
   * Poles, beams, pillars, stairs and ladders snap the game's way, by their snap points:
   * `anchor` (one of them, on the plan) goes on a grid point, so a pole's axis lands on a
   * wall joint and a beam's end on a corner, and they turn about `centre` (the middle of
   * their snap points: a pole's axis). Null for other props: their footprint snaps.
   */
  snap: PropSnap | null;
  /** Normalised EN name, PL name and prefab, for `filterProps`. */
  search: string;
}

/** A point in the prefab's local plan (metres from its pivot; x, and z across). */
export interface LocalPoint {
  x: number;
  z: number;
}

export interface PropSnap {
  anchor: LocalPoint;
  centre: LocalPoint;
}

/** The stand-in footprint for pieces without a collider (and unknown prefabs). */
export const APPROX_RECT: LocalRect = { minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 };
/** The stand-in height span: a 1 m cube standing on the pivot. */
export const APPROX_HEIGHT = { minY: 0, maxY: 1 } as const;

const SHIPS = new Set(['Raft', 'Karve', 'VikingShip', 'VikingShip_Ashlands']);

const STAIRS = new Set([
  'wood_stair',
  'ashwood_stair',
  'stone_stair',
  'blackmarble_stair',
  'piece_grausten_stonestair',
  'wood_stepladder',
  'Piece_grausten_stone_ladder',
]);

/** Upright and level poles, beams and pillars (diagonal beams aren't boxes). */
const STRUCTURE = new Set([
  'wood_pole',
  'wood_pole2',
  'wood_beam_1',
  'wood_beam',
  'wood_pole_log',
  'wood_pole_log_4',
  'darkwood_pole',
  'darkwood_pole4',
  'darkwood_beam',
  'darkwood_beam4x4',
  'ashwood_pole_1m',
  'ashwood_pole_2m',
  'ashwood_beam_1m',
  'ashwood_beam_2m',
  'woodiron_pole',
  'woodiron_beam',
  'stave_pole_2m',
  'stave_pole_4m',
  'stave_beam_2m',
  'stave_beam_4m',
  'Piece_flametal_pillar',
  'Piece_flametal_beam',
  'stone_pillar',
  'Piece_grausten_pillarbase_small',
  'Piece_grausten_pillarbase_medium',
  'Piece_grausten_pillarbase_tapered',
  'Piece_grausten_pillarbase_tapered_inverted',
  'Piece_grausten_pillarbeam_small',
  'Piece_grausten_pillarbeam_medium',
]);

const GROUP_BY_CATEGORY: Record<string, PropGroup> = {
  crafting: 'crafting',
  furniture: 'furniture',
  misc: 'misc',
};

/**
 * The prop group of a piece, or null when it isn't a prop: building pieces, structural
 * Deep North pieces (those with snap points) and the repair tool. Poles and beams are
 * checked first: the timber ones are Deep North pieces with snap points.
 */
export const propGroup = (piece: PieceDef): PropGroup | null => {
  if (SHIPS.has(piece.prefab)) return 'ships';
  if (STAIRS.has(piece.prefab)) return 'stairs';
  if (STRUCTURE.has(piece.prefab)) return 'structure';
  if (piece.category === 'deep-north') return piece.snapPoints.length === 0 ? 'furniture' : null;
  return GROUP_BY_CATEGORY[piece.category] ?? null;
};

/** Lower case, no diacritics (ł included, which NFD keeps), `_` as a space. */
export const normalizeSearch = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/_/g, ' ');

const round6 = (n: number): number => Math.round(n * 1e6) / 1e6 + 0;

/** Snap-point snapping for load-bearing props (see `PropDef.snap`); null without points. */
const snapOf = (piece: PieceDef, group: PropGroup): PropSnap | null => {
  if (!LOAD_BEARING_GROUPS.has(group) || piece.snapPoints.length === 0) return null;
  const points = piece.snapPoints.map(([x, , z]) => ({ x: round6(x), z: round6(z) }));
  const [anchor] = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const xs = points.map((p) => p.x);
  const zs = points.map((p) => p.z);
  const centre = {
    x: round6((Math.min(...xs) + Math.max(...xs)) / 2),
    z: round6((Math.min(...zs) + Math.max(...zs)) / 2),
  };
  return anchor ? { anchor, centre } : null;
};

/** A stair's climb from its snap points: up by their height, along z to their top end. */
const flightOf = (piece: PieceDef): NonNullable<PropDef['flight']> => {
  const ys = piece.snapPoints.map((p) => p[1]);
  const top = piece.snapPoints.find((p) => p[1] === Math.max(...ys));
  const bottom = piece.snapPoints.find((p) => p[1] === Math.min(...ys));
  const towards = top && bottom && top[2] < bottom[2] ? -1 : 1;
  return { rise: snapExtent(piece, 'y'), run: snapExtent(piece, 'z'), towards };
};

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
        heightRange: piece.colliderBounds
          ? { minY: piece.colliderBounds[0][1], maxY: piece.colliderBounds[1][1] }
          : APPROX_HEIGHT,
        approximate: rect === null,
        comfort: piece.comfort,
        material: piece.material,
        snap: snapOf(piece, group),
        flight: group === 'stairs' ? flightOf(piece) : null,
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
