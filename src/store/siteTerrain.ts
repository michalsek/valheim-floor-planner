/**
 * The plan's site ground (M16): the decoded terrain of an imported build with its
 * frame, one object per import frame, so views and support share it. Support always
 * uses it; the views only while the Terrain toggle (`terrainShownAtom`) is on.
 */
import { useAtomValue } from 'jotai';

import { terrainGrid, type TerrainGrid } from '../model/terrain/siteTerrain';
import type { ImportFrame, Plan, SiteTerrain } from '../model/types';

import { usePlanSelector } from './planHooks';
import { terrainShownAtom } from './session';

export interface SiteGround {
  grid: TerrainGrid;
  frame: ImportFrame;
  terrain: SiteTerrain;
}

const grounds = new WeakMap<ImportFrame, SiteGround>();

/** The plan's ground; null without terrain (no import, or imported without it). */
export const getSiteGround = (plan: Plan): SiteGround | null => {
  const frame = plan.importFrame;
  const terrain = frame?.terrain;
  if (!frame || !terrain) return null;
  let ground = grounds.get(frame);
  if (!ground) grounds.set(frame, (ground = { grid: terrainGrid(terrain), frame, terrain }));
  return ground;
};

/** The committed plan's ground, whether shown or not. */
export const useSiteTerrain = (): SiteGround | null => usePlanSelector(getSiteGround);

/** The ground the views draw: null while the Terrain toggle is off. */
export const useShownSiteTerrain = (): SiteGround | null => {
  const ground = useSiteTerrain();
  return useAtomValue(terrainShownAtom) ? ground : null;
};
