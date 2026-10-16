import rawPieces from '../../research/valheim-pieces.json';

import { parseCatalog } from './pieceDefs';
import { deriveWallFamilies, WALL_FAMILY_SPECS } from './wallFamilies';

export const catalog = parseCatalog(rawPieces);
export const wallFamilies = deriveWallFamilies(catalog, WALL_FAMILY_SPECS);

export type { Catalog, PieceDef } from './pieceDefs';
export type { WallFamily } from './wallFamilies';
