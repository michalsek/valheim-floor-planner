import { useAtom, useAtomValue } from 'jotai';

import { Button } from '../../controls/Button';
import { keepFocus } from '../../controls/keepFocus';
import { NumberInput } from '../../controls/NumberInput';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { ToggleButton } from '../../controls/ToggleButton';
import { formatCompact } from '../../format';
import { sameLevel } from '../../model/elevation';
import { levelsOf, wallTops, type Level } from '../../model/levels';
import { getLibrary } from '../../store/libraryInstance';
import { getPieceBoxes, usePlan } from '../../store/planHooks';
import {
  elevationStepAtom,
  levelPickAtom,
  supportViewAtom,
  workDatumAtom,
  type ElevationStep,
} from '../../store/session';
import { jumpToTops, setWorkElevation, stepLevel } from '../../tools/levelActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './LevelsBar.module.css';

const STEPS: readonly { value: ElevationStep; label: string }[] = [
  { value: 1, label: '1 m' },
  { value: 0.5, label: '0.5 m' },
];

/** "+3 m", "0 m", "−1.5 m". */
const levelName = (e: number): string =>
  `${e > 0 ? '+' : e < 0 ? '−' : ''}${formatCompact(Math.abs(e))} m`;

/** The plan's levels, top to bottom, with the current one in even when it is empty. */
const useLevels = (datum: number): Level[] => {
  const plan = usePlan();
  const levels = levelsOf(plan, getPieceBoxes(plan), getLibrary());
  if (levels.some((l) => sameLevel(l.elevation, datum))) return levels;
  return [...levels, { elevation: datum, count: 0 }].sort((a, b) => b.elevation - a.elevation);
};

/**
 * The levels at the canvas edge: one row per elevation with something on it (click to
 * go there), the current level with ▲ / ▼ and a field, the step, Tops (to the highest
 * wall top here), Pick (the next click picks a piece's top), and the support view.
 */
export const LevelsBar = () => {
  const ctx = useToolContext();
  const datum = useAtomValue(workDatumAtom);
  const [step, setStep] = useAtom(elevationStepAtom);
  const [picking, setPicking] = useAtom(levelPickAtom);
  const [supportView, setSupportView] = useAtom(supportViewAtom);
  const levels = useLevels(datum);
  const hasTops = wallTops(usePlan(), datum, getLibrary()).length > 0;

  return (
    <div className={styles.bar} role="toolbar" aria-label="Levels">
      <div className={styles.current}>
        <Button title="Up a step (PageUp)" onClick={() => stepLevel(ctx, 1)}>
          ▲
        </Button>
        <NumberInput
          key={datum}
          label="Current level in metres"
          value={datum}
          step={step}
          onCommit={(e) => setWorkElevation(ctx, e)}
        />
        <Button title="Down a step (PageDown)" onClick={() => stepLevel(ctx, -1)}>
          ▼
        </Button>
      </div>
      <SegmentedControl<ElevationStep>
        label="Level step"
        options={STEPS}
        value={step}
        onChange={(v) => setStep(v)}
      />
      <ul className={styles.levels}>
        {levels.map(({ elevation, count }) => {
          const current = sameLevel(elevation, datum);
          return (
            <li key={elevation}>
              <button
                type="button"
                className={current ? `${styles.level} ${styles.levelCurrent}` : styles.level}
                aria-current={current}
                title="Go to this level (Shift+PageUp / PageDown: the next one)"
                onMouseDown={keepFocus}
                onClick={() => setWorkElevation(ctx, elevation)}
              >
                <span className={styles.levelName}>{levelName(elevation)}</span>
                <span className={styles.count}>{count === 0 ? 'empty' : count}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className={styles.actions}>
        <Button
          title="Up to the highest wall top on this level"
          disabled={!hasTops}
          onClick={() => jumpToTops(ctx)}
        >
          Tops
        </Button>
        <ToggleButton
          title="Click a piece to go to its top (Esc to stop)"
          pressed={picking}
          onChange={setPicking}
        >
          Pick
        </ToggleButton>
      </div>
      <ToggleButton
        title="Colour pieces by structural support"
        pressed={supportView}
        onChange={setSupportView}
      >
        Support
      </ToggleButton>
    </div>
  );
};
