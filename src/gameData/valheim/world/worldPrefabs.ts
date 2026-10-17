/**
 * Which prefabs a world scan keeps: the Hammer's catalogue, by stable hash, without the
 * vehicles. Ships and carts are catalogue pieces with a creator too, but they drift and
 * sail, so they are no part of a build.
 */
import { stableHash } from './stableHash';

export const VEHICLES: ReadonlySet<string> = new Set([
  'Cart',
  'Raft',
  'Karve',
  'VikingShip',
  'VikingShip_Ashlands',
]);

export const scanPrefabs = (catalogue: Iterable<string>): Map<number, string> =>
  new Map(
    [...catalogue].filter((name) => !VEHICLES.has(name)).map((name) => [stableHash(name), name])
  );
