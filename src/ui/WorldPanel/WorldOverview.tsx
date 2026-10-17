import { useMemo, useState } from 'react';

import { formatCompact } from '../../format';
import type { LoadedWorld } from '../../install/loadWorld';
import { MAX_RAW_PIECES } from '../../model/rawPieces';
import {
  DEFAULT_MIN_CLUSTER,
  describeCluster,
  groupPieces,
  type WorldCluster,
} from '../../model/world/clusters';
import { getLibrary } from '../../store/libraryInstance';
import { importBuild } from '../../store/worldImport';
import { closeWorldPanel } from '../../install/loadWorld';
import { useToolContext } from '../../tools/toolContext';

import { ClusterMap } from './ClusterMap';
import styles from './WorldPanel.module.css';

const materialOf = (prefab: string) => getLibrary().catalog.pieces.get(prefab)?.material ?? null;

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

/** A read world: its builds on a map and in a list, with the minimum size and Import. */
export const WorldOverview = ({ world }: { world: LoadedWorld }) => {
  const ctx = useToolContext();
  const [minSize, setMinSize] = useState(DEFAULT_MIN_CLUSTER);
  const [selected, setSelectedIndex] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const setSelected = (index: number) => {
    setSelectedIndex(index);
    setImportError(null);
  };
  const groups = useMemo(() => groupPieces(world.pieces), [world.pieces]);
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

  const importCurrent = () => {
    if (!current) return;
    const result = importBuild(ctx, world, current);
    if (result === 'done') closeWorldPanel();
    else setImportError(typeof result === 'object' ? result.error : null);
  };

  return (
    <div className={styles.overview}>
      <p className={styles.muted}>
        {total.toLocaleString('en-GB')} built pieces of {world.zdos.toLocaleString('en-GB')} objects
        {world.generation !== null && ` · save ${world.generation}`} ·{' '}
        {world.fromCache ? 'kept copy' : 'read'} in {Math.round(world.readMs)} ms
      </p>
      <div className={styles.overviewGrid}>
        <ClusterMap
          cloud={world.pieces}
          clusters={clusters}
          selected={current}
          onSelect={(c) => setSelected(clusters.indexOf(c))}
        />
        <div className={styles.clusterSide}>
          <label className={styles.minSize}>
            Builds of at least{' '}
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
                  onDoubleClick={importCurrent}
                >
                  <strong>{c.indices.length.toLocaleString('en-GB')} pieces</strong>
                  <span className={styles.muted}>{describe(c)}</span>
                </button>
              </li>
            ))}
          </ol>
          {clusters.length === 0 && <p className={styles.note}>No builds this big.</p>}
          {current && (
            <div className={styles.importRow}>
              <button
                type="button"
                className={styles.primary}
                disabled={current.indices.length > MAX_RAW_PIECES}
                onClick={importCurrent}
              >
                Import as a new plan
              </button>
              <p className={styles.note}>
                {importError ??
                  (current.indices.length > MAX_RAW_PIECES
                    ? `Too big: a plan holds at most ${MAX_RAW_PIECES.toLocaleString('en-GB')} pieces.`
                    : 'Pieces come in as they are, turned to the build’s grid: you can move, turn, delete and count them.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
