import { frameGridOf } from '../../model/world/frameGrid';
import { planBuildYaw, reframeProblem } from '../../model/world/reframe';
import type { Plan } from '../../model/types';
import { usePlanSelector } from '../../store/planHooks';
import { reframeImport } from '../../store/worldImport';
import { useToolContext } from '../../tools/toolContext';

import styles from './StatusStrip.module.css';

const gridOf = (plan: Plan) => (plan.importFrame ? frameGridOf(plan.importFrame) : null);

const WORLD_TITLE =
  'The plan’s grid runs along the world’s axes (north up), on the game’s terrain grid: ground edits follow these lines, and the build shows at its angle.';
const BUILD_TITLE =
  'The plan’s grid follows the build’s walls, for drawing along an off-axis build; the game’s terrain grid runs along the world’s axes.';

/**
 * The imported plan's grid: "Grid: world" or "Grid: build 22.5°". A click turns it the
 * other way (one undo step), for a plan of imported pieces only; its title says why not.
 */
export const GridFrameButton = () => {
  const ctx = useToolContext();
  const grid = usePlanSelector(gridOf);
  const buildYaw = usePlanSelector(planBuildYaw);
  const problem = usePlanSelector(reframeProblem);
  if (!grid) return null;
  const other = grid === 'world' ? 'build' : 'world';
  const action =
    other === 'world'
      ? 'Click to run it along the world’s axes.'
      : `Click to turn it along the build (${buildYaw}°).`;
  const title = [grid === 'world' ? WORLD_TITLE : BUILD_TITLE, problem ?? action].join('\n\n');
  const turn = () => {
    if (problem) return;
    const result = reframeImport(ctx, other);
    if (result !== 'done') window.alert(`The grid couldn’t be turned: ${result.error}`);
  };
  return (
    <button
      type="button"
      className={styles.installButton}
      title={title}
      aria-disabled={problem !== null}
      onClick={turn}
    >
      {grid === 'world' ? 'Grid: world' : `Grid: build ${buildYaw}°`}
    </button>
  );
};
