/**
 * The world a plan's site came from, when this browser has it: growing the site needs
 * its seed and the save's terrain edits, which the plan never holds. It is the World
 * panel's open world when that matches the import (its name and a build at the frame's
 * origin), else a kept world (OPFS) of the same name that does. Nothing is read from
 * the save itself, so a world never opened in this browser isn't found.
 */
import { getWorldState } from '../install/loadWorld';
import { worldMatchesFrame, type TerrainSource } from '../install/siteGeneration';
import { listCachedWorlds, loadCachedWorld } from '../install/worldCache';
import type { ImportFrame } from '../model/types';
import type { PieceCloud } from '../model/world/pieceCloud';
import { worldSites, type WorldSites } from '../model/world/revealSites';

import { persistedAtom } from './browserStorage';

/**
 * Whether extending the terrain also brings in the sites it reveals (the World panel's
 * "Load revealed sites"), remembered per browser. On by default.
 */
export const revealSitesAtom = persistedAtom<boolean>(
  'valheimFloorPlanner.revealSites.v1',
  true,
  (stored) => (stored === 'true' ? true : stored === 'false' ? false : null),
  String
);

const sitesByCloud = new WeakMap<PieceCloud, WorldSites>();

/** A read world's sites (`worldSites`), worked out once per world. */
export const sitesOf = (world: Pick<TerrainSource, 'pieces'>): WorldSites => {
  let sites = sitesByCloud.get(world.pieces);
  if (!sites) {
    sites = worldSites(world.pieces);
    sitesByCloud.set(world.pieces, sites);
  }
  return sites;
};

/** Which import a found world is for: its world's name and origin. */
export const siteWorldKey = (frame: ImportFrame): string =>
  `${frame.worldName}|${frame.origin.x}|${frame.origin.y}|${frame.origin.z}`;

/**
 * The last kept world found, so growing again doesn't decode it again; dropped once it is
 * no longer kept (Forget).
 */
let found: { key: string; entry: string; world: TerrainSource } | null = null;

/** The world `frame`'s import came from, or null when this browser doesn't have it. */
export const findSiteWorld = async (frame: ImportFrame): Promise<TerrainSource | null> => {
  const { status } = getWorldState();
  if (status.kind === 'ready' && worldMatchesFrame(status.world, frame)) return status.world;
  const key = siteWorldKey(frame);
  const named = (await listCachedWorlds()).filter((w) => w.name === frame.worldName);
  if (found && !named.some((w) => w.key === found!.entry)) found = null;
  if (found?.key === key) return found.world;
  for (const entry of named) {
    const world = await loadCachedWorld(entry.key);
    if (world && worldMatchesFrame(world, frame)) {
      found = { key, entry: entry.key, world };
      return world;
    }
  }
  return null;
};
