/**
 * Values the parser needs that live in game code, not in serialized data: enum
 * definitions and a switch in `WearNTear.GetMaterialProperties`. Parsing .NET metadata
 * is out of scope, so they are copied by hand from Valheim 1.0.20 / Unity 6000.0.75f1
 * (`assembly_valheim.dll`). `catalog/stations.ts` keeps the station upgrade maximums.
 */

/** Bump when the parser's output changes, so cached catalogues are rebuilt. */
export const PARSER_VERSION = 1;

/** Where the Hammer's piece table sits in the bundles (and in `manifest_extended`). */
export const HAMMER_TABLE_PATH = 'Assets/GameElements/Pieces/_HammerPieceTable.prefab';

/** The ward, whose `PrivateArea.m_radius` is the ward radius. */
export const WARD_PREFAB = 'guard_stone';

/** The localization TextAsset in `resources.assets` (an RFC 4180 CSV). */
export const LOCALIZATION_ASSET = 'localization';

/** `Piece.PieceCategory`; other values (e.g. 100, "All") pass through as numbers. */
export const CATEGORY_NAMES: Readonly<Record<number, string>> = {
  0: 'misc',
  1: 'crafting',
  2: 'building',
  3: 'heavy-building',
  4: 'furniture',
  5: 'deep-north',
};

/** `WearNTear.MaterialType`, by value. */
export const MATERIAL_NAMES: readonly string[] = [
  'wood',
  'stone',
  'iron',
  'hardwood',
  'marble',
  'ashstone',
  'ancient',
  'ice',
  'timberwood',
];

/** [maxSupport, minSupport, verticalLoss, horizontalLoss] per material. */
export const MATERIAL_SUPPORT: Readonly<Record<string, readonly number[]>> = {
  wood: [100, 10, 0.125, 0.2],
  stone: [1000, 100, 0.125, 1.0],
  iron: [1500, 20, 0.07692, 0.07692],
  hardwood: [140, 10, 0.1, 0.16667],
  marble: [1500, 100, 0.125, 0.5],
  ashstone: [2000, 100, 0.1, 0.33333],
  ancient: [5000, 100, 0.06667, 0.25],
  ice: [1000, 100, 0.125, 0.33333],
  timberwood: [200, 10, 0.07692, 0.2],
};
