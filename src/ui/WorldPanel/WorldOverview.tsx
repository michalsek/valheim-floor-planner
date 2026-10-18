import { useMemo, useState } from 'react';

import { formatCompact } from '../../format';
import type { LoadedWorld } from '../../install/loadWorld';
import {
  CLUSTER_LINK,
  DEFAULT_MIN_CLUSTER,
  describeCluster,
  type WorldCluster,
} from '../../model/world/clusters';
import { getLibrary } from '../../store/libraryInstance';
import { sitesOf } from '../../store/siteWorld';

import { AddTerrain } from './AddTerrain';
import { ClusterMap } from './ClusterMap';
import { ImportRow } from './ImportRow';
import { RevealToggle } from './RevealToggle';
import { useBuildImport } from './useBuildImport';
import { useTerrainTask } from './useTerrainTask';
import styles from './WorldPanel.module.css';

const materialOf = (prefab: string) => getLibrary().catalog.pieces.get(prefab)?.material ?? null;

const SITE_TITLE = `Pieces within ${CLUSTER_LINK} m of each other (a ward's radius) are one site.`;

const SKIPPED_TITLE =
  'Placed by a player but not a building piece the planner knows: ships and carts, crops and ground edits, or pieces from a mod or a newer game.';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "40 × 58 m · 18 m tall · wood · 22.5°" */
const describe = (c: WorldCluster): string =>
  [
    `${formatCompact(Math.round(c.size.x))} × ${formatCompact(Math.round(c.size.z))} m`,
    `${formatCompact(Math.round(c.maxY - c.minY))} m tall`,
    c.material && capitalise(c.material),
    `${c.yaw}°`,
  ]
    .filter(Boolean)
    .join(' · ');

/** A read world: its sites on a map and in a list, with the minimum size and Import. */
export const WorldOverview = ({ world }: { world: LoadedWorld }) => {
  const [minSize, setMinSize] = useState(DEFAULT_MIN_CLUSTER);
  const [selected, setSelectedIndex] = useState(0);
  // The same sites the terrain reveals later (worked out once per world).
  const groups = useMemo(() => sitesOf(world).groups, [world]);
  const clusters = useMemo(
    () =>
      groups
        .filter((g) => g.length >= minSize)
        .map((g) => describeCluster(world.pieces, g, materialOf)),
    [groups, minSize, world.pieces]
  );
  const hidden = groups.length - clusters.length;
  const current = clusters[selected] ?? clusters[0];
  const total = world.pieces.prefabIndex.length;
  const task = useTerrainTask();
  const importer = useBuildImport(world, current, task);
  const setSelected = (index: number) => {
    setSelectedIndex(index);
    importer.setError(null);
  };

  return (
    <div className={styles.overview}>
      <p className={styles.muted}>
        {total.toLocaleString('en-GB')} built pieces of {world.zdos.toLocaleString('en-GB')} objects
        {world.generation !== null && ` · save ${world.generation}`} ·{' '}
        {world.fromCache ? 'kept copy' : 'read'} in {Math.round(world.readMs)} ms
        {world.skipped > 0 && (
          <span title={SKIPPED_TITLE}>
            {' '}
            · {world.skipped.toLocaleString('en-GB')} other placed{' '}
            {world.skipped === 1 ? 'object' : 'objects'} left out
          </span>
        )}
      </p>
      <AddTerrain world={world} task={task} />
      <div className={styles.overviewGrid}>
        <ClusterMap
          cloud={world.pieces}
          clusters={clusters}
          selected={current}
          onSelect={(c) => setSelected(clusters.indexOf(c))}
        />
        <div className={styles.clusterSide}>
          <label className={styles.minSize} title={SITE_TITLE}>
            Sites of at least{' '}
            <input
              type="number"
              min={1}
              max={1000}
              value={minSize}
              onChange={(e) => {
                setMinSize(Math.max(1, Math.round(Number(e.currentTarget.value) || 1)));
                setSelected(0);
              }}
            />{' '}
            pieces
          </label>
          {hidden > 0 && (
            <p className={styles.note}>
              {hidden} smaller {hidden === 1 ? 'group' : 'groups'} hidden.
            </p>
          )}
          <ol className={styles.clusters}>
            {clusters.map((c, i) => (
              <li key={c.indices[0]}>
                <button
                  type="button"
                  className={
                    c === current ? `${styles.cluster} ${styles.clusterOn}` : styles.cluster
                  }
                  onClick={() => setSelected(i)}
                  onDoubleClick={() => void importer.start()}
                >
                  <strong>{c.indices.length.toLocaleString('en-GB')} pieces</strong>
                  <span className={styles.muted}>{describe(c)}</span>
                </button>
              </li>
            ))}
          </ol>
          {clusters.length === 0 && <p className={styles.note}>No sites this big.</p>}
          <ImportRow importer={importer} />
          <RevealToggle />
        </div>
      </div>
    </div>
  );
};
