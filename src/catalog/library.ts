import type { FloorFamily } from './floorFamilies';
import type { ItemName } from './items';
import type { OpeningDef } from './openingDefs';
import type { Catalog } from './pieceDefs';
import type { PropDef } from './propDefs';
import type { WallFamily } from './wallFamilies';

/** The catalogue data plan logic reads, in one object (see `buildLibrary`). */
export interface Library {
  catalog: Catalog;
  wallFamilies: ReadonlyMap<string, WallFamily>;
  floorFamilies: ReadonlyMap<string, FloorFamily>;
  openingDefs: ReadonlyMap<string, OpeningDef>;
  /** Placeable props (stations, furniture, ships…), by prefab. */
  propDefs: ReadonlyMap<string, PropDef>;
  /** Display names of resource items, by item id. */
  items: ReadonlyMap<string, ItemName>;
}
