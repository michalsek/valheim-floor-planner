/**
 * Loads the real models of the prefabs a plan uses, while mounted: each prefab once,
 * its textures and materials shared, everything the plan stops using disposed (and
 * all of it on unmount). Reports progress in `modelLoadAtom`; models that need the
 * game folder wait for `modelRetryAtom` (bumped after reconnecting it).
 */
import { useThree } from '@react-three/fiber';
import { useSetAtom, useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WebGPURenderer } from 'three/webgpu';

import { GameDataError } from '../../../gameData/GameDataError';
import { modelLoadAtom, modelRetryAtom } from '../../../store/modelView';

import { createModelResources, type ReadyModel } from './modelResources';
import { bcSupport } from './textureSupport';

/** A prefab's outcome: its model (null: it draws nothing), or why there is none. */
type Result = ReadyModel | null | 'blocked' | 'failed';

const isBlocked = (error: unknown) => error instanceof GameDataError && error.code === 'permission';

/** The ready models of `prefabs`, by prefab (prefabs still loading are missing). */
export const useModels = (
  prefabs: readonly string[],
  panelOpacity: number
): ReadonlyMap<string, ReadyModel> => {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const invalidate = useThree((s) => s.invalidate);
  const retry = useAtomValue(modelRetryAtom);
  const setLoad = useSetAtom(modelLoadAtom);
  const [resources] = useState(() => createModelResources(bcSupport(gl), panelOpacity));
  const [results, setResults] = useState<ReadonlyMap<string, Result>>(new Map());
  const pending = useRef(new Set<string>());
  const settled = useRef(new Map<string, Result>());
  const wanted = useRef<ReadonlySet<string>>(new Set());
  const lastRetry = useRef(retry);

  const key = prefabs.join('\n');
  useEffect(() => {
    wanted.current = new Set(key ? key.split('\n') : []);
    resources.retain(wanted.current);
    if (lastRetry.current !== retry) {
      lastRetry.current = retry;
      for (const [prefab, result] of settled.current) {
        if (result === 'blocked') settled.current.delete(prefab);
      }
    }
    const settle = (prefab: string, result: Result) => {
      settled.current.set(prefab, result);
      setResults(new Map(settled.current));
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
          if (wanted.current.has(prefab)) settle(prefab, isBlocked(error) ? 'blocked' : 'failed');
        }
      );
    };
    for (const prefab of wanted.current) {
      if (!pending.current.has(prefab) && !settled.current.has(prefab)) request(prefab);
    }
    // Forget prefabs no longer used: their materials are gone.
    const gone = [...settled.current.keys()].filter((prefab) => !wanted.current.has(prefab));
    if (gone.length > 0) {
      gone.forEach((prefab) => settled.current.delete(prefab));
      setResults(new Map(settled.current));
    }
  }, [resources, key, retry, invalidate]);

  useEffect(
    () => () => {
      wanted.current = new Set();
      resources.dispose();
    },
    [resources]
  );

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
    for (const prefab of prefabs) {
      const result = results.get(prefab);
      if (result === 'blocked') blocked++;
      else if (result !== undefined) done++;
    }
    setLoad({ done, total: prefabs.length, blocked });
  }, [prefabs, results, setLoad]);
  useEffect(() => () => setLoad(null), [setLoad]);

  return ready;
};
