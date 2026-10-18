/**
 * Builds the catalogue the editor uses from raw game data: the pieces and item names
 * in the shape of `RawPieces` / `RawItems` (`gameData/valheim/extractCatalogue.ts`),
 * whether they come from the install parser, its cache or (in tests) the game-data
 * fixtures (`testGameData.ts`).
 */
import { deriveFloorFamilies, FLOOR_FAMILY_SPECS } from './floorFamilies';
import { parseItems } from './items';
import type { Library } from './library';
import { deriveOpeningDefs } from './openingDefs';
import { parseCatalog } from './pieceDefs';
import { buildPropDefs } from './propDefs';
import {
  deriveGableWallSets,
  deriveRoofFamilies,
  GABLE_WALL_SPECS,
  ROOF_FAMILY_SPECS,
} from './roofFamilies';
import { deriveWallFamilies, WALL_FAMILY_SPECS } from './wallFamilies';

export const DEFAULT_WALL_FAMILY_ID = 'wood';
export const DEFAULT_FLOOR_FAMILY_ID = 'wood';
export const DEFAULT_ROOF_FAMILY_ID = 'thatch';

const byKey = <T>(items: readonly T[], key: (item: T) => string): ReadonlyMap<string, T> =>
  new Map(items.map((item) => [key(item), item]));

/** Throws when the data is malformed or lacks a piece a wall/floor family needs. */
export const buildLibrary = (rawPieces: unknown, rawItems: unknown): Library => {
  const catalog = parseCatalog(rawPieces);
  const wallFamilies = deriveWallFamilies(catalog, WALL_FAMILY_SPECS);
  return {
    catalog,
    wallFamilies: byKey(wallFamilies, (f) => f.id),
    floorFamilies: byKey(deriveFloorFamilies(catalog, FLOOR_FAMILY_SPECS), (f) => f.id),
    openingDefs: deriveOpeningDefs(catalog, wallFamilies),
    // Props in catalogue order (the browser sorts its results).
    propDefs: byKey(buildPropDefs(catalog), (d) => d.prefab),
    roofFamilies: byKey(deriveRoofFamilies(catalog, ROOF_FAMILY_SPECS), (f) => f.id),
    gableWallSets: byKey(deriveGableWallSets(catalog, GABLE_WALL_SPECS), (s) => s.id),
    items: parseItems(rawItems),
  };
};
