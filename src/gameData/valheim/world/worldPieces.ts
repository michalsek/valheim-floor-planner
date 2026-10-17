/**
 * A world's built pieces as flat typed arrays (tens of thousands in a big world). No
 * creator, no player data: only what the planner draws.
 */
import type { Zdo } from './readZdo';

export interface WorldPieces {
  /** Prefab names, indexed by `prefabIndex`. */
  prefabs: string[];
  prefabIndex: Uint16Array<ArrayBuffer>;
  /** x, y, z per piece: the prefab's pivot (metres, raw Unity axes). */
  position: Float32Array<ArrayBuffer>;
  /** Stored pitch, yaw, roll per piece (Euler degrees, as saved). */
  rotation: Float32Array<ArrayBuffer>;
}

export const pieceCount = (pieces: Pick<WorldPieces, 'prefabIndex'>): number =>
  pieces.prefabIndex.length;

/** Collects pieces one at a time, then packs them. */
export const pieceCollector = (names: ReadonlyMap<number, string>) => {
  const prefabs: string[] = [];
  const indexOf = new Map<number, number>();
  const index: number[] = [];
  const position: number[] = [];
  const rotation: number[] = [];
  return {
    add(zdo: Zdo): void {
      let i = indexOf.get(zdo.prefab);
      if (i === undefined) {
        i = prefabs.push(names.get(zdo.prefab)!) - 1;
        indexOf.set(zdo.prefab, i);
      }
      index.push(i);
      position.push(zdo.x, zdo.y, zdo.z);
      rotation.push(zdo.pitch, zdo.yaw, zdo.roll);
    },
    pack: (): WorldPieces => ({
      prefabs,
      prefabIndex: Uint16Array.from(index),
      position: Float32Array.from(position),
      rotation: Float32Array.from(rotation),
    }),
  };
};
