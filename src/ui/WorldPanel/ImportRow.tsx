import { MAX_RAW_PIECES } from '../../model/rawPieces';

import type { BuildImport } from './useBuildImport';
import { phaseText } from './useTerrainTask';
import { revealNotice } from './worldCopy';
import styles from './WorldPanel.module.css';

const IMPORT_NOTE =
  'Pieces come in as they are, turned to the build’s grid: you can move, turn, delete and count them.';
const TERRAIN_NOTE =
  'The ground around the build, made from the world’s seed and your terrain edits.';
const NEARBY_NOTE =
  'Other sites of this world on the build’s terrain (64 m around it) come in too, whole, in the same frame.';

/** The Import button with its terrain option, or the progress while the ground is made. */
export const ImportRow = ({ importer }: { importer: BuildImport }) => {
  const { build, tooBig, withTerrain, setWithTerrain, nearby, setNearby, error, task, start } =
    importer;
  if (!build) return null;
  const prepared = 'error' in build ? null : build;
  const available = prepared?.terrain.ok ?? false;
  const reason = prepared && !prepared.terrain.ok ? prepared.terrain.reason : null;

  const phase = task.phaseOf('import');
  if (phase) {
    return (
      <div className={styles.importRow}>
        <p className={styles.progress} role="status">
          {phaseText(phase)}
        </p>
        <button type="button" className={styles.button} onClick={task.skip}>
          Skip terrain
        </button>
      </div>
    );
  }
  const note =
    error ??
    ('error' in build
      ? `Can’t import this build: ${build.error}`
      : tooBig
        ? `Too big: a plan holds at most ${MAX_RAW_PIECES.toLocaleString('en-GB')} pieces.`
        : IMPORT_NOTE);
  return (
    <div className={styles.importRow}>
      <div className={styles.importActions}>
        <button
          type="button"
          className={styles.primary}
          disabled={!prepared || tooBig || task.running !== null}
          onClick={() => void start()}
        >
          Import as a new plan
        </button>
        <label
          className={available ? styles.terrainOption : `${styles.terrainOption} ${styles.off}`}
          title={reason ?? TERRAIN_NOTE}
        >
          <input
            type="checkbox"
            checked={available && withTerrain}
            disabled={!available}
            onChange={(e) => setWithTerrain(e.currentTarget.checked)}
          />{' '}
          With terrain
        </label>
        <label className={styles.terrainOption} title={NEARBY_NOTE}>
          <input
            type="checkbox"
            checked={nearby}
            onChange={(e) => setNearby(e.currentTarget.checked)}
          />{' '}
          Include nearby sites
        </label>
      </div>
      {reason && <p className={styles.note}>No terrain: {reason}</p>}
      {prepared && nearby && revealNotice(prepared.nearby, 'Brings along') && (
        <p className={styles.note}>{revealNotice(prepared.nearby, 'Brings along')}</p>
      )}
      <p className={error ? `${styles.note} ${styles.error}` : styles.note}>{note}</p>
    </div>
  );
};
