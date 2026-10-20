import { useAtom, useAtomValue } from 'jotai';

import { Button } from '../../controls/Button';
import { keepFocus } from '../../controls/keepFocus';
import { NumberInput } from '../../controls/NumberInput';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { ToggleButton } from '../../controls/ToggleButton';
import { formatLevel } from '../../format';
import type { StoreyStop } from '../../model/cut';
import { sameLevel } from '../../model/elevation';
import { useViewMode } from '../../store/hooks';
import { getStoreyStops, usePlan } from '../../store/planHooks';
import {
  cutGhostAtom,
  cutHeightAtom,
  cutStepAtom,
  supportViewAtom,
  workPlaneAtom,
  type CutStep,
} from '../../store/session';
import { setCut, stepCut, toggleAll } from '../../tools/cutActions';
import { useToolContext } from '../../tools/toolContext';

import { LevelViewControls } from './LevelViewControls';
import styles from './LevelsBar.module.css';

const STEPS: readonly { value: CutStep; label: string }[] = [
  { value: 1, label: '1 m' },
  { value: 0.5, label: '0.5 m' },
];

/** The storey stops, top to bottom: click one to cut there. */
const StopRows = ({ stops, h }: { stops: readonly StoreyStop[]; h: number | null }) => {
  const ctx = useToolContext();
  return (
    <ul className={styles.levels}>
      {[...stops].reverse().map(({ height, count }) => {
        const current = h !== null && sameLevel(height, h);
        return (
          <li key={height}>
            <button
              type="button"
              className={current ? `${styles.level} ${styles.levelCurrent}` : styles.level}
              aria-current={current}
              title="Cut here: hides this floor and what starts above it (Shift+PageUp / PageDown: the next stop)"
              onMouseDown={keepFocus}
              onClick={() => setCut(ctx, height)}
            >
              <span className={styles.levelName}>{formatLevel(height)}</span>
              <span className={styles.count}>{count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

/**
 * The cut at the canvas edge (interim; pass 3 replaces it with the Cut bar): the cut
 * height with ▲ / ▼ and a field, All (C), the step, the storey stops, where new items go,
 * the support view and (3D) the ghost toggle and the plate's frost.
 */
export const LevelsBar = () => {
  const ctx = useToolContext();
  const h = useAtomValue(cutHeightAtom);
  const plane = useAtomValue(workPlaneAtom);
  const [step, setStep] = useAtom(cutStepAtom);
  const [ghosts, setGhosts] = useAtom(cutGhostAtom);
  const [supportView, setSupportView] = useAtom(supportViewAtom);
  const is3d = useViewMode() === '3d';
  const stops = getStoreyStops(usePlan());

  return (
    <div className={styles.bar} role="toolbar" aria-label="Cut">
      <div className={styles.current}>
        <Button title="Cut a step higher (PageUp)" onClick={() => stepCut(ctx, 1)}>
          ▲
        </Button>
        {h !== null && (
          <NumberInput
            key={h}
            label="Cut height in metres"
            value={h}
            step={step}
            onCommit={(next) => setCut(ctx, next)}
          />
        )}
        <Button title="Cut a step lower (PageDown)" onClick={() => stepCut(ctx, -1)}>
          ▼
        </Button>
      </div>
      <div className={styles.actions}>
        <ToggleButton
          title="Show everything, no cut (C: back to the cut)"
          pressed={h === null}
          onChange={() => toggleAll(ctx)}
        >
          All
        </ToggleButton>
      </div>
      <SegmentedControl<CutStep>
        label="Cut step"
        options={STEPS}
        value={step}
        onChange={(v) => setStep(v)}
      />
      {stops.length > 0 && <StopRows stops={stops} h={h} />}
      <p className={styles.plane}>Items go on {formatLevel(plane)}</p>
      <div className={styles.actions}>
        <ToggleButton
          title="Colour pieces by structural support"
          pressed={supportView}
          onChange={setSupportView}
        >
          Support
        </ToggleButton>
      </div>
      {is3d && (
        <>
          <div className={styles.actions}>
            <ToggleButton
              title="Draw what is above the cut as a faded ghost (it can't be picked)"
              pressed={ghosts}
              onChange={setGhosts}
            >
              Ghost
            </ToggleButton>
          </div>
          <LevelViewControls />
        </>
      )}
    </div>
  );
};
