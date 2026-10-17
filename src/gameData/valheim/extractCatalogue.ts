/**
 * Builds the planner's catalogue from the game files: every piece on the Hammer's
 * piece table with its names, category, station, material, health, comfort, cost,
 * snap points and collider bounds, plus station build ranges, the ward radius and the
 * names of the resource items. The output has the shape of
 * `research/valheim-pieces.json` and `valheim-items.json`, so `buildLibrary` reads it.
 */
import type { ByteSource } from '../bytes/ByteSource';
import { GameDataError } from '../GameDataError';
import { openSerializedFile, type SerializedFile } from '../unity/serializedFile';
import { findTextAsset } from '../unity/textAsset';
import {
  fields,
  list,
  localRef,
  num,
  readFields,
  str,
  type Fields,
  type V3,
} from '../unity/values';

import {
  CATEGORY_NAMES,
  LOCALIZATION_ASSET,
  MATERIAL_NAMES,
  MATERIAL_SUPPORT,
  WARD_PREFAB,
} from './constants';
import { aabb, walkPrefabs, type PrefabShape } from './hierarchy';
import { parseLocalization, type Localization } from './localization';
import { behaviourWith, openPieceBundle, pieceTable } from './pieceBundle';

export interface CatalogueSources {
  /** The bundle holding the piece table (named in `manifest_extended`). */
  bundle: ByteSource;
  /** `resources.assets`, for the localization table. */
  resources: ByteSource;
}

export type ExtractPhase = 'bundle' | 'pieces' | 'shapes' | 'names';

export interface ExtractProgress {
  phase: ExtractPhase;
  /** Objects read so far. */
  objects: number;
}

export interface RawPiece {
  prefab: string;
  name: string;
  namePl: string | null;
  category: string | number;
  station: string | null;
  material: string | null;
  health: number | null;
  comfort: number;
  resources: [item: string, amount: number][];
  snapPoints: V3[];
  colliderBounds: [V3, V3] | null;
  colliderSize: V3 | null;
}

export interface RawPieces {
  meta: {
    source: string;
    materialSupport: Record<string, readonly number[]>;
    stationBuildRange: Record<string, [baseRadius: number, perUpgrade: number]>;
    wardRadius_m: number;
  };
  pieces: RawPiece[];
}

export type RawItems = Record<string, { name: string; namePl: string }>;

export interface ExtractResult {
  pieces: RawPieces;
  items: RawItems;
  unityVersion: string;
}

/** MonoBehaviours are told apart by their fields (their scripts live in other files). */
const FIELD_PIECE = 'm_category';
const FIELD_WEAR_N_TEAR = 'm_materialType';
const FIELD_CRAFTING_STATION = 'm_rangeBuild';
const FIELD_WARD = 'm_radius';

/** A piece-table prefab with the components the catalogue reads (null when absent). */
interface Prefab {
  id: bigint;
  name: string;
  piece: Fields | null;
  wearNTear: Fields | null;
  station: Fields | null;
  ward: Fields | null;
}

/** A component referenced by a piece (a station, a resource item), with its GameObject's name. */
interface Owned {
  name: string;
  component: Fields;
}

const round3 = (v: number): number => Math.round(v * 1000) / 1000;
const round3v = (v: V3): V3 => [round3(v[0]), round3(v[1]), round3(v[2])];

/** Reads the prefabs, then their relevant MonoBehaviours in one batch. */
const readPrefabs = (file: SerializedFile, ids: readonly bigint[]): Prefab[] => {
  const gameObjects = readFields(file, ids);
  const found = ids.map((id) => {
    const go = gameObjects.get(id)!;
    return {
      id,
      name: str(go.m_Name, 'm_Name'),
      piece: behaviourWith(file, go, FIELD_PIECE),
      wearNTear: behaviourWith(file, go, FIELD_WEAR_N_TEAR),
      station: behaviourWith(file, go, FIELD_CRAFTING_STATION),
      ward: behaviourWith(file, go, FIELD_WARD),
    };
  });
  const behaviours = readFields(
    file,
    found.flatMap((p) => [p.piece, p.wearNTear, p.station, p.ward].filter((id) => id !== null))
  );
  const get = (id: bigint | null) => (id === null ? null : behaviours.get(id)!);
  return found.map((p) => ({
    ...p,
    piece: get(p.piece),
    wearNTear: get(p.wearNTear),
    station: get(p.station),
    ward: get(p.ward),
  }));
};

const resourcesOf = (piece: Fields) =>
  list(piece.m_resources, 'm_resources').map((value) => {
    const res = fields(value, 'requirement');
    return { itemId: localRef(res.m_resItem, 'm_resItem'), amount: num(res.m_amount, 'm_amount') };
  });

/**
 * Pieces point at stations (CraftingStation) and resource items (ItemDrop) by
 * component; this reads those components and their GameObjects (whose names are the
 * station and item IDs).
 */
const readReferences = (file: SerializedFile, prefabs: readonly Prefab[]): Map<bigint, Owned> => {
  const ids = prefabs.flatMap(({ piece }) =>
    piece
      ? [
          localRef(piece.m_craftingStation, 'm_craftingStation'),
          ...resourcesOf(piece).map((r) => r.itemId),
        ].filter((id) => id !== null)
      : []
  );
  const components = readFields(file, ids);
  const ownerOf = (c: Fields) => localRef(c.m_GameObject, 'm_GameObject');
  const owners = readFields(
    file,
    [...components.values()].map(ownerOf).filter((id) => id !== null)
  );
  return new Map(
    [...components].flatMap(([id, component]) => {
      const owner = ownerOf(component);
      const go = owner === null ? undefined : owners.get(owner);
      return go ? [[id, { name: str(go.m_Name, 'm_Name'), component }] as const] : [];
    })
  );
};

const loadLocalization = (resources: ByteSource): Localization => {
  const file = openSerializedFile(resources);
  const bytes = findTextAsset(file, LOCALIZATION_ASSET);
  if (!bytes) throw new GameDataError('incomplete', 'resources.assets has no localization');
  return parseLocalization(new TextDecoder('utf-8').decode(bytes));
};

/** `$piece_bed` → its text in `table`, or null. */
const localize = (table: ReadonlyMap<string, string>, token: string): string | null =>
  table.get(token.replace(/^\$+/, '')) ?? null;

const shapeFields = (shape: PrefabShape) => {
  const bounds = aabb(shape.corners);
  const min = bounds && round3v(bounds[0]);
  const max = bounds && round3v(bounds[1]);
  return {
    snapPoints: shape.snaps.map(round3v),
    colliderBounds: min && max ? ([min, max] as [V3, V3]) : null,
    colliderSize: min && max ? round3v([max[0] - min[0], max[1] - min[1], max[2] - min[2]]) : null,
  };
};

const rawPiece = (
  prefab: Prefab,
  piece: Fields,
  refs: ReadonlyMap<bigint, Owned>,
  shape: PrefabShape,
  loc: Localization
): RawPiece => {
  const token = str(piece.m_name, 'm_name');
  const wnt = prefab.wearNTear;
  const material = wnt && num(wnt.m_materialType, 'm_materialType');
  const category = num(piece.m_category, 'm_category');
  const station = localRef(piece.m_craftingStation, 'm_craftingStation');
  return {
    prefab: prefab.name,
    name: localize(loc.en, token) ?? token,
    namePl: localize(loc.pl, token),
    category: CATEGORY_NAMES[category] ?? category,
    station: (station !== null && refs.get(station)?.name) || null,
    material: material === null ? null : (MATERIAL_NAMES[material] ?? `material${material}`),
    health: wnt && num(wnt.m_health, 'm_health'),
    comfort: num(piece.m_comfort, 'm_comfort'),
    resources: resourcesOf(piece).map(({ itemId, amount }) => [
      (itemId !== null && refs.get(itemId)?.name) || 'unknown',
      amount,
    ]),
    ...shapeFields(shape),
  };
};

/** Names of every resource item the pieces use, by item ID (sorted). */
const rawItems = (
  prefabs: readonly Prefab[],
  refs: ReadonlyMap<bigint, Owned>,
  loc: Localization
): RawItems => {
  const drops = new Map<string, Fields>();
  for (const { piece } of prefabs) {
    for (const { itemId } of piece ? resourcesOf(piece) : []) {
      const ref = itemId === null ? undefined : refs.get(itemId);
      if (ref) drops.set(ref.name, ref.component);
    }
  }
  const items: RawItems = {};
  for (const id of [...drops.keys()].sort()) {
    const itemData = drops.get(id)!.m_itemData;
    const shared =
      itemData === undefined ? null : fields(fields(itemData, 'm_itemData').m_shared, 'm_shared');
    const token = shared ? str(shared.m_name, 'm_shared.m_name') : '';
    const name = localize(loc.en, token) ?? id;
    items[id] = { name, namePl: localize(loc.pl, token) ?? name };
  }
  return items;
};

const stationRanges = (prefabs: readonly Prefab[]): Record<string, [number, number]> =>
  Object.fromEntries(
    prefabs.flatMap(({ name, station }) =>
      station
        ? [
            [
              name,
              [
                num(station.m_rangeBuild, 'm_rangeBuild'),
                num(station.m_extraRangePerLevel, 'm_extraRangePerLevel'),
              ],
            ],
          ]
        : []
    )
  );

const wardRadius = (prefabs: readonly Prefab[]): number => {
  const ward = prefabs.find((p) => p.name === WARD_PREFAB)?.ward;
  if (!ward) throw new GameDataError('missingPieces', `no ${WARD_PREFAB}`);
  return num(ward.m_radius, 'm_radius');
};

export const extractCatalogue = (
  sources: CatalogueSources,
  onProgress: (progress: ExtractProgress) => void = () => {}
): ExtractResult => {
  onProgress({ phase: 'bundle', objects: 0 });
  const { file } = openPieceBundle(sources.bundle);
  const report = (phase: ExtractPhase) => onProgress({ phase, objects: file.objectsRead });

  report('pieces');
  const prefabs = readPrefabs(file, pieceTable(file));
  const refs = readReferences(file, prefabs);

  report('shapes');
  const shapes = walkPrefabs(
    file,
    prefabs.map((p) => p.id),
    () => report('shapes')
  );

  report('names');
  const loc = loadLocalization(sources.resources);
  const pieces = prefabs.flatMap((p) =>
    p.piece ? [rawPiece(p, p.piece, refs, shapes.get(p.id)!, loc)] : []
  );

  return {
    pieces: {
      meta: {
        source: `Valheim install (Unity ${file.unityVersion}), parsed in the browser`,
        materialSupport: { ...MATERIAL_SUPPORT },
        stationBuildRange: stationRanges(prefabs),
        wardRadius_m: wardRadius(prefabs),
      },
      pieces,
    },
    items: rawItems(prefabs, refs, loc),
    unityVersion: file.unityVersion,
  };
};
