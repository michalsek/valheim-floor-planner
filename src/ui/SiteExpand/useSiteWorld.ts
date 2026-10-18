import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { getWorldState, subscribeWorld } from '../../install/loadWorld';
import type { TerrainSource } from '../../install/siteGeneration';
import type { ImportFrame } from '../../model/types';
import { findSiteWorld, siteWorldKey } from '../../store/siteWorld';

/** Whether the site's world is at hand: not looked for yet, found, or not in this browser. */
export type SiteWorldStatus = 'unknown' | 'found' | 'missing';

/**
 * The world the plan's site came from (`findSiteWorld`), looked for lazily: kept worlds
 * are read from OPFS only when a handle is first hovered or clicked (`resolve`), not on
 * load. Looked for again when the World panel opens or forgets a world.
 */
export const useSiteWorld = (frame: ImportFrame) => {
  const key = siteWorldKey(frame);
  const panel = useSyncExternalStore(subscribeWorld, getWorldState);
  const [found, setFound] = useState<{ key: string; world: TerrainSource | null } | null>(null);
  const asked = useRef(false);

  const resolve = useCallback(async (): Promise<TerrainSource | null> => {
    asked.current = true;
    const world = await findSiteWorld(frame);
    setFound({ key: siteWorldKey(frame), world });
    return world;
  }, [frame]);

  // A world opened or forgotten in the panel may change the answer (and the site grows
  // into a new frame object): ask again, once asked.
  useEffect(() => {
    if (asked.current) void resolve();
  }, [panel.status, panel.recent, resolve]);

  const current = found?.key === key ? found : null;
  const status: SiteWorldStatus = !current ? 'unknown' : current.world ? 'found' : 'missing';
  return { world: current?.world ?? null, status, resolve };
};
