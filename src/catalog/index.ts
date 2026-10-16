import rawPieces from '../../research/valheim-pieces.json';

import { parseCatalog } from './pieceDefs';
import { deriveWallFamilies, WALL_FAMILY_SPECS, type WallFamily } from './wallFamilies';

export const catalog = parseCatalog(rawPieces);
export const wallFamilies = deriveWallFamilies(catalog, WALL_FAMILY_SPECS);
export const wallFamilyById: ReadonlyMap<string, WallFamily> = new Map(
  wallFamilies.map((f) => [f.id, f])
);
export const DEFAULT_WALL_FAMILY_ID = 'wood';

export type { Catalog, PieceDef } from './pieceDefs';
export type { WallFamily } from './wallFamilies';
