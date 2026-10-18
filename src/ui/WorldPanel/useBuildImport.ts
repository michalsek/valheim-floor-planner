import { useMemo, useState } from 'react';

import { closeWorldPanel, type LoadedWorld } from '../../install/loadWorld';
import { MAX_RAW_PIECES } from '../../model/rawPieces';
import type { WorldCluster } from '../../model/world/clusters';
import { importBuild, prepareBuild } from '../../store/worldImport';
import { useToolContext } from '../../tools/toolContext';

import { useTerrainTask } from './useTerrainTask';

/** Importing the selected build: the "With terrain" option, progress, Skip terrain. */
export const useBuildImport = (world: LoadedWorld, cluster: WorldCluster | undefined) => {
  const ctx = useToolContext();
  const task = useTerrainTask();
  const [withTerrain, setWithTerrain] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const build = useMemo(() => cluster && prepareBuild(world, cluster), [world, cluster]);
  const tooBig = !!cluster && cluster.indices.length > MAX_RAW_PIECES;

  const start = async () => {
    if (!build || 'error' in build || tooBig || task.phase) return;
    setError(null);
    const terrain = withTerrain && build.terrain.ok;
    const result = await task.start((opts) =>
      importBuild(ctx, world, build, terrain ? opts : null)
    );
    if (result === 'done') closeWorldPanel();
    else if (typeof result === 'object') setError(result.error);
  };

  return { build, tooBig, withTerrain, setWithTerrain, error, setError, task, start };
};

export type BuildImport = ReturnType<typeof useBuildImport>;
