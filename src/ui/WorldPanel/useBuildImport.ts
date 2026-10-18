import { useMemo, useState } from 'react';

import { closeWorldPanel, type LoadedWorld } from '../../install/loadWorld';
import { MAX_RAW_PIECES } from '../../model/rawPieces';
import type { WorldCluster } from '../../model/world/clusters';
import { importBuild, prepareBuild } from '../../store/worldImport';
import { useToolContext } from '../../tools/toolContext';

import type { TerrainTask } from './useTerrainTask';

/**
 * Importing the selected build: the "With terrain" and "Include nearby sites" options,
 * progress, Skip terrain.
 */
export const useBuildImport = (
  world: LoadedWorld,
  cluster: WorldCluster | undefined,
  task: TerrainTask
) => {
  const ctx = useToolContext();
  const [withTerrain, setWithTerrain] = useState(true);
  const [nearby, setNearby] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const build = useMemo(
    () => cluster && prepareBuild(world, cluster, nearby),
    [world, cluster, nearby]
  );
  const tooBig = !!cluster && cluster.indices.length > MAX_RAW_PIECES;

  const start = async () => {
    if (!build || 'error' in build || tooBig || task.running) return;
    setError(null);
    const terrain = withTerrain && build.terrain.ok;
    const result = await task.start('import', (opts) =>
      importBuild(ctx, world, build, terrain ? opts : null)
    );
    if (result === 'done') closeWorldPanel();
    else if (result && typeof result === 'object') setError(result.error);
  };

  return {
    build,
    tooBig,
    withTerrain,
    setWithTerrain,
    nearby,
    setNearby,
    error,
    setError,
    task,
    start,
  };
};

export type BuildImport = ReturnType<typeof useBuildImport>;
