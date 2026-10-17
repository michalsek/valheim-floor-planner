/**
 * Loads the real models of the prefabs a plan uses: each prefab once, its textures and
 * materials shared. The resources are kept per renderer across 3D view mounts, so
 * leaving 3D and coming back relinks nothing (WebGL2 links shader programs
 * synchronously); what the plan stops using is disposed, and everything once the view
 * goes back to boxes (`releaseModels`). Reports progress in `modelLoadAtom`. Models that
 * need the game folder, or failed, are asked for again when the folder comes back or
 * the cache was cleared (`retryToken`).
 */
import { useThree } from '@react-three/fiber';
import { useSetAtom } from 'jotai';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { WebGPURenderer } from 'three/webgpu';

import { GameDataError } from '../../../gameData/GameDataError';
import {
  getAssetState,
  loadModel,
  loadTexture,
  noteWantedModels,
  subscribeAssets,
} from '../../../install/assetClient';
import { getInstallState, subscribeInstall } from '../../../install/loadInstall';
import { modelLoadAtom } from '../../../store/modelView';

import { createModelResources, type ModelResources, type ReadyModel } from './modelResources';
import { bcSupport } from './textureSupport';

/**
 * A prefab's outcome: its model (null: it draws nothing), or why there is none
 * (`blocked`: it waits for the game folder). Both kinds of failure are tried again
 * when the retry token changes.
 */
type Result = ReadyModel | null | 'blocked' | 'failed';

const outcome = (error: unknown): Result =>
  error instanceof GameDataError && error.code === 'permission' ? 'blocked' : 'failed';

const shared = new WeakMap<object, ModelResources>();

const resourcesFor = (gl: WebGPURenderer): ModelResources => {
  let resources = shared.get(gl);
  if (!resources) {
    resources = createModelResources(bcSupport(gl), { loadModel, loadTexture });
    shared.set(gl, resources);
  }
  return resources;
};

/** Frees every model resource of the renderer (the 3D view went back to boxes). */
export const releaseModels = (gl: object): void => shared.get(gl)?.dispose();

/** Changes when models that couldn't load may load now (folder back, cache cleared). */
const retryToken = () => `${getInstallState().assetFiles}:${getAssetState().generation}`;
const subscribeRetry = (listener: () => void) => {
  const offInstall = subscribeInstall(listener);
  const offAssets = subscribeAssets(listener);
  return () => {
    offInstall();
    offAssets();
  };
};

export interface Models {
  resources: ModelResources;
  /** The ready models of the prefabs, by prefab (prefabs still loading are missing). */
  ready: ReadonlyMap<string, ReadyModel>;
}

export const useModels = (prefabs: readonly string[]): Models => {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const invalidate = useThree((s) => s.invalidate);
  const retry = useSyncExternalStore(subscribeRetry, retryToken);
  const setLoad = useSetAtom(modelLoadAtom);
  const resources = resourcesFor(gl);
  // Every prefab's outcome so far (mutated; `results` is its snapshot). Models loaded
  // before this mount show at once.
  const [settled] = useState(() => {
    const known = new Map<string, Result>();
    for (const prefab of prefabs) {
      const model = resources.peek(prefab);
      if (model !== undefined) known.set(prefab, model);
    }
    return known;
  });
  const [results, setResults] = useState<ReadonlyMap<string, Result>>(() => new Map(settled));
  const pending = useRef(new Set<string>());
  const failure = useRef<string | null>(null);
  const wanted = useRef<ReadonlySet<string>>(new Set());
  const lastRetry = useRef(retry);

  const key = prefabs.join('\n');
  useEffect(() => {
    wanted.current = new Set(key ? key.split('\n') : []);
    resources.retain(wanted.current);
    noteWantedModels([...wanted.current]);
    if (lastRetry.current !== retry) {
      lastRetry.current = retry;
      for (const [prefab, result] of settled) {
        if (result === 'blocked' || result === 'failed') settled.delete(prefab);
      }
    }
    const settle = (prefab: string, result: Result) => {
      settled.set(prefab, result);
      setResults(new Map(settled));
      invalidate();
    };
    const request = (prefab: string) => {
      pending.current.add(prefab);
      resources.load(prefab).then(
        (model) => {
          pending.current.delete(prefab);
          // Dropped while it loaded (no longer used): ask again if it is used again.
          if (model !== undefined) settle(prefab, model);
          else if (wanted.current.has(prefab)) request(prefab);
        },
        (error: unknown) => {
          pending.current.delete(prefab);
          if (!wanted.current.has(prefab)) return;
          const result = outcome(error);
          if (result === 'failed') failure.current = error instanceof Error ? error.message : null;
          settle(prefab, result);
        }
      );
    };
    for (const prefab of wanted.current) {
      if (!pending.current.has(prefab) && !settled.has(prefab)) request(prefab);
    }
    // Forget prefabs no longer used: their materials are gone.
    const gone = [...settled.keys()].filter((prefab) => !wanted.current.has(prefab));
    if (gone.length > 0) {
      gone.forEach((prefab) => settled.delete(prefab));
      setResults(new Map(settled));
    }
  }, [resources, settled, key, retry, invalidate]);

  const ready = useMemo(() => {
    const map = new Map<string, ReadyModel>();
    for (const prefab of prefabs) {
      const result = results.get(prefab);
      if (result && typeof result === 'object') map.set(prefab, result);
    }
    return map;
  }, [prefabs, results]);

  useEffect(() => {
    let done = 0;
    let blocked = 0;
    let failed = 0;
    for (const prefab of prefabs) {
      const result = results.get(prefab);
      if (result === 'blocked') blocked++;
      else if (result === 'failed') failed++;
      else if (result !== undefined) done++;
    }
    setLoad({ done, total: prefabs.length, blocked, failed, failure: failure.current });
  }, [prefabs, results, setLoad]);
  useEffect(() => () => setLoad(null), [setLoad]);

  return { resources, ready };
};
