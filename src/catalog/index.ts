import rawPieces from '../../research/valheim-pieces.json';

import { deriveFloorFamilies, FLOOR_FAMILY_SPECS, type FloorFamily } from './floorFamilies';
import type { Library } from './library';
import { deriveOpeningDefs, openingChoicesFor, type OpeningDef } from './openingDefs';
import { parseCatalog } from './pieceDefs';
import { buildPropDefs, type PropDef } from './propDefs';
import { deriveWallFamilies, WALL_FAMILY_SPECS, type WallFamily } from './wallFamilies';

export const catalog = parseCatalog(rawPieces);
export const wallFamilies = deriveWallFamilies(catalog, WALL_FAMILY_SPECS);
export const wallFamilyById: ReadonlyMap<string, WallFamily> = new Map(
  wallFamilies.map((f) => [f.id, f])
);
export const DEFAULT_WALL_FAMILY_ID = 'wood';

export const floorFamilies = deriveFloorFamilies(catalog, FLOOR_FAMILY_SPECS);
export const floorFamilyById: ReadonlyMap<string, FloorFamily> = new Map(
  floorFamilies.map((f) => [f.id, f])
);
export const DEFAULT_FLOOR_FAMILY_ID = 'wood';

export const openingDefByPrefab: ReadonlyMap<string, OpeningDef> = deriveOpeningDefs(
  catalog,
  wallFamilies
);

/** The opening picker's list for walls of `familyId`. */
export const openingChoices = (familyId: string): OpeningDef[] =>
  openingChoicesFor(openingDefByPrefab, wallFamilyById.get(familyId));

/** Props in catalogue order (the browser sorts its results). */
export const propDefs: readonly PropDef[] = buildPropDefs(catalog);
export const propDefByPrefab: ReadonlyMap<string, PropDef> = new Map(
  propDefs.map((d) => [d.prefab, d])
);

export const library: Library = {
  catalog,
  wallFamilies: wallFamilyById,
  floorFamilies: floorFamilyById,
  openingDefs: openingDefByPrefab,
  propDefs: propDefByPrefab,
};

export type { Catalog, PieceDef } from './pieceDefs';
export type { FloorFamily } from './floorFamilies';
export type { Library } from './library';
export type { OpeningDef } from './openingDefs';
export type { PropDef, PropGroup } from './propDefs';
export type { WallFamily } from './wallFamilies';
