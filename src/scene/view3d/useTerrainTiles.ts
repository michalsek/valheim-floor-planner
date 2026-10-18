import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BufferGeometry } from 'three/webgpu';

import type { TerrainTile } from '../../model/terrain/siteTiles';
import { groundTiles, type SiteGround } from '../../store/siteTerrain';
import { useDetachedFrame } from '../useDetachedFrame';

import { tileGeometry } from './tileGeometry';

/** Main-thread time a frame may spend making tiles (ms); at least one is made a frame. */
const FRAME_BUDGET = 6;
/** Vertices of tiles kept beyond the shown site's (for undo, redo and other sites). */
const KEEP_EXTRA = 600_000;

/** A tile as drawn: its mesh, which may be the tile's last one until the new one is made. */
export interface ShownTile {
  id: string;
  geometry: BufferGeometry;
}

/** Made meshes by tile key, least recently used first. Re-entering 3D only uploads them. */
const made = new Map<string, BufferGeometry>();

const vertices = (geometry: BufferGeometry) => geometry.getAttribute('position').count;

const takeMade = (key: string): BufferGeometry | undefined => {
  const geometry = made.get(key);
  if (geometry) {
    made.delete(key);
    made.set(key, geometry);
  }
  return geometry;
};

/** Drops the least recently used meshes not in `keep` beyond `KEEP_EXTRA` vertices. */
const evict = (keep: ReadonlySet<string>) => {
  let extra = 0;
  for (const [key, geometry] of made) if (!keep.has(key)) extra += vertices(geometry);
  for (const [key, geometry] of made) {
    if (extra <= KEEP_EXTRA) break;
    if (keep.has(key)) continue;
    extra -= vertices(geometry);
    made.delete(key);
    geometry.dispose();
  }
};

/** How many mounted surfaces use `made`. */
let holders = 0;

/**
 * Once no surface is mounted (the terrain gone, e.g. after New, or the view left), every
 * made mesh is freed, its arrays and GPU buffers: up to ~100 MB at the cap. Checked a
 * microtask later, so StrictMode's simulated unmount, which remounts at once, keeps them.
 */
const releaseMade = () => {
  holders--;
  queueMicrotask(() => {
    if (holders > 0) return;
    made.forEach((geometry) => geometry.dispose());
    made.clear();
  });
};

const shownList = (
  tiles: readonly TerrainTile[],
  shown: ReadonlyMap<string, BufferGeometry>
): ShownTile[] =>
  tiles.flatMap(({ id }) => {
    const geometry = shown.get(id);
    return geometry ? [{ id, geometry }] : [];
  });

/**
 * The site's surface tiles to draw (`siteTiles.ts`, `tileGeometry.ts`). Tiles whose mesh isn't made
 * yet are made a few each frame, nearest the camera first, so a large site never
 * blocks a frame for long; meanwhile a tile shows its previous mesh (an extension's old
 * border) or nothing (a new strip, the first entry into 3D). Unmounting frees the
 * meshes (`releaseMade`); entering 3D again makes them again.
 */
export const useTerrainTiles = (ground: SiteGround): readonly ShownTile[] => {
  const invalidate = useThree((s) => s.invalidate);
  const tiles = groundTiles(ground);
  const shown = useRef(new Map<string, BufferGeometry>());
  const pending = useRef<TerrainTile[]>([]);
  const [list, setList] = useState<readonly ShownTile[]>([]);

  // A new site: what is already made shows at once, the rest is queued.
  useLayoutEffect(() => {
    const previous = shown.current;
    shown.current = new Map();
    pending.current = [];
    for (const tile of tiles) {
      const geometry = takeMade(tile.key);
      if (!geometry) pending.current.push(tile);
      const current = geometry ?? previous.get(tile.id);
      if (current) shown.current.set(tile.id, current);
    }
    setList(shownList(tiles, shown.current));
    if (pending.current.length > 0) invalidate();
    else evict(new Set(tiles.map((t) => t.key)));
  }, [tiles, invalidate]);

  useDetachedFrame(({ camera }) => {
    if (pending.current.length === 0) return;
    const { x, z } = camera.position;
    const distance = ({ centre }: TerrainTile) => Math.hypot(centre.x - x, centre.z - z);
    pending.current.sort((a, b) => distance(a) - distance(b));
    const started = performance.now();
    do {
      const tile = pending.current.shift()!;
      const geometry = takeMade(tile.key) ?? tileGeometry(ground, tile);
      made.set(tile.key, geometry);
      shown.current.set(tile.id, geometry);
    } while (pending.current.length > 0 && performance.now() - started < FRAME_BUDGET);
    setList(shownList(tiles, shown.current));
    if (pending.current.length > 0) invalidate();
    else evict(new Set(tiles.map((t) => t.key)));
  });

  useEffect(() => {
    holders++;
    const [shownTiles, pendingTiles] = [shown, pending];
    return () => {
      // Nothing of this instance holds meshes once unmounted (a stale frame callback
      // kept by the renderer's dev state would otherwise keep them alive).
      shownTiles.current = new Map();
      pendingTiles.current = [];
      releaseMade();
    };
  }, []);

  return list;
};
