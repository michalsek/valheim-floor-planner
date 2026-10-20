import type { ItemName } from './items';
import type { Catalog } from './pieceDefs';
import type { PropDef } from './propDefs';
import type { GableWallSet, RoofFamily } from './roofFamilies';

/** The catalogue data plan logic reads, in one object (see `buildLibrary`). */
export interface Library {
  catalog: Catalog;
  /** Placeable props (stations, furniture, ships…), by prefab. */
  propDefs: ReadonlyMap<string, PropDef>;
  /** Roof families: which pieces are roof covers, ridges and corners, by id. */
  roofFamilies: ReadonlyMap<string, RoofFamily>;
  /** Triangle walls for gable ends, by id. */
  gableWallSets: ReadonlyMap<string, GableWallSet>;
  /** Display names of resource items, by item id. */
  items: ReadonlyMap<string, ItemName>;
}
