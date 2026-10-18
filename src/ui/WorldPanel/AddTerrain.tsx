import { useMemo, useState } from 'react';

import { closeWorldPanel, type LoadedWorld } from '../../install/loadWorld';
import { siteRect, terrainAvailability, worldMatchesFrame } from '../../install/siteGeneration';
import type { Plan } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { usePlan } from '../../store/planHooks';
import { addTerrain } from '../../store/worldImport';
import { useToolContext } from '../../tools/toolContext';

import { phaseText, type TerrainTask } from './useTerrainTask';
import styles from './WorldPanel.module.css';

/** The current plan's import has no ground and came from this world. */
const missingTerrain = (plan: Plan, world: LoadedWorld): boolean =>
  !!plan.importFrame && !plan.importFrame.terrain && worldMatchesFrame(world, plan.importFrame);

/**
 * "Add terrain to the current plan", shown over a world's builds when the plan was
 * imported from it without terrain (an older import, or terrain skipped).
 */
export const AddTerrain = ({ world, task }: { world: LoadedWorld; task: TerrainTask }) => {
  const ctx = useToolContext();
  const plan = usePlan();
  const [error, setError] = useState<string | null>(null);
  const show = missingTerrain(plan, world);
  const availability = useMemo(() => {
    const rect = show ? siteRect(plan, getLibrary()) : null;
    return rect && terrainAvailability(world, rect);
  }, [show, plan, world]);
  if (!show || !availability) return null;

  const add = async () => {
    setError(null);
    const result = await task.start('add', (opts) => addTerrain(ctx, world, opts));
    if (result === 'done') closeWorldPanel();
    else if (result && typeof result === 'object') setError(result.error);
  };
  const phase = task.phaseOf('add');

  return (
    <div className={styles.banner}>
      {phase ? (
        <>
          <span role="status">{phaseText(phase)}</span>
          <button type="button" className={styles.button} onClick={task.cancel}>
            Cancel
          </button>
        </>
      ) : availability.ok ? (
        <>
          <span>The current plan came from this world without its ground.</span>
          <button
            type="button"
            className={styles.primary}
            disabled={task.running !== null}
            onClick={() => void add()}
          >
            Add terrain to the current plan
          </button>
        </>
      ) : (
        <span>The current plan came from this world; no terrain: {availability.reason}</span>
      )}
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
};

/**
 * On the panel's start: which world to open to add the current plan's ground, or to
 * extend it (the site's edge handles need the world; the plan doesn't keep it).
 */
export const AddTerrainHint = () => {
  const frame = usePlan().importFrame;
  if (!frame) return null;
  return frame.terrain ? (
    <p className={styles.note}>
      The current plan’s ground came from <strong>{frame.worldName}</strong>: open that world to
      extend it from the handles at the site’s edges.
    </p>
  ) : (
    <p className={styles.note}>
      The current plan was imported from <strong>{frame.worldName}</strong> without its ground: open
      that world to add terrain to it.
    </p>
  );
};
