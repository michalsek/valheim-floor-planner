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

/**
 * Pre-1.0 terrain edits saved as pieces (a `TerrainModifier` with the player flag) that
 * change the ground's height. The game still applies them live, before the zone's
 * `TerrainComp`, until `optterrain` folds them in; the planner doesn't apply them, it
 * counts them (research/README.md §8). `path` and `replant` only paint, so aren't here.
 */
export const LEGACY_TERRAIN_EDITS: ReadonlySet<number> = new Set(
  ['raise', 'digg', 'digg_v2', 'cultivate', 'mud_road', 'paved_road'].map(stableHash)
);
