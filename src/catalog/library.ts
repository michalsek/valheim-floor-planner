import type { FloorFamily } from './floorFamilies';
import type { ItemName } from './items';
import type { OpeningDef } from './openingDefs';
import type { Catalog } from './pieceDefs';
import type { PropDef } from './propDefs';
import type { GableWallSet, RoofFamily } from './roofFamilies';
import type { WallFamily } from './wallFamilies';

/** The catalogue data plan logic reads, in one object (see `buildLibrary`). */
export interface Library {
  catalog: Catalog;
  wallFamilies: ReadonlyMap<string, WallFamily>;
  floorFamilies: ReadonlyMap<string, FloorFamily>;
  openingDefs: ReadonlyMap<string, OpeningDef>;
  /** Placeable props (stations, furniture, ships…), by prefab. */
  propDefs: ReadonlyMap<string, PropDef>;
  /** Roof families this install can build, by id. */
  roofFamilies: ReadonlyMap<string, RoofFamily>;
  /** Triangle walls for gable ends, by id. */
  gableWallSets: ReadonlyMap<string, GableWallSet>;
  /** Display names of resource items, by item id. */
  items: ReadonlyMap<string, ItemName>;
}
