import { useAtom, useAtomValue } from 'jotai';
import { useEffect } from 'react';

import { Button } from '../../controls/Button';
import { keepFocus } from '../../controls/keepFocus';
import { NumberInput } from '../../controls/NumberInput';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { ToggleButton } from '../../controls/ToggleButton';
import { formatLevel } from '../../format';
import { sameLevel } from '../../model/elevation';
import { levelsOf, selectionLevels, wallTops, type Level } from '../../model/levels';
import { useViewMode } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { getPieceBoxes, usePlan } from '../../store/planHooks';
import { selectionAtom } from '../../store/selection';
import {
  elevationStepAtom,
  levelHoverAtom,
  levelPickAtom,
  supportViewAtom,
  workDatumAtom,
  type ElevationStep,
} from '../../store/session';
import { jumpToTops, setWorkElevation, stepLevel } from '../../tools/levelActions';
import { useToolContext } from '../../tools/toolContext';

import { LevelViewControls } from './LevelViewControls';
import styles from './LevelsBar.module.css';

const STEPS: readonly { value: ElevationStep; label: string }[] = [
  { value: 1, label: '1 m' },
  { value: 0.5, label: '0.5 m' },
];

/** The plan's levels, top to bottom, with the current one in even when it is empty. */
const useLevels = (datum: number): Level[] => {
  const plan = usePlan();
  const levels = levelsOf(plan, getPieceBoxes(plan), getLibrary());
  if (levels.some((l) => sameLevel(l.elevation, datum))) return levels;
  return [...levels, { elevation: datum, count: 0 }].sort((a, b) => b.elevation - a.elevation);
};

/** Whether any selected item is on the level at `elevation`. */
const useSelectionOn = (): ((elevation: number) => boolean) => {
  const levels = selectionLevels(usePlan(), useAtomValue(selectionAtom), getLibrary());
  return (elevation) => [...levels].some((l) => sameLevel(l, elevation));
};

/**
 * The level rows: click one to go there; in 3D, hovering one previews it (cleared on
 * leaving the list, on unmount, on a view switch and when its row goes, e.g. on undo).
 * A dot marks the selection's levels.
 */
const LevelRows = ({ levels, datum }: { levels: Level[]; datum: number }) => {
  const ctx = useToolContext();
  const [hover, setHover] = useAtom(levelHoverAtom);
  const is3d = useViewMode() === '3d';
  const selectionOn = useSelectionOn();
  useEffect(() => {
    setHover(null);
    return () => setHover(null);
  }, [is3d, setHover]);
  const rowGone = hover !== null && !levels.some((l) => sameLevel(l.elevation, hover));
  useEffect(() => {
    if (rowGone) setHover(null);
  }, [rowGone, setHover]);

  return (
    <ul className={styles.levels} onMouseLeave={() => setHover(null)}>
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
              onMouseEnter={() => setHover(is3d ? elevation : null)}
              onClick={() => setWorkElevation(ctx, elevation)}
            >
              <span className={styles.levelName}>
                {selectionOn(elevation) && (
                  <span className={styles.selectionDot} title="Selection is on this level">
                    <span className={styles.visuallyHidden}>Selection is on this level: </span>
                  </span>
                )}
                {formatLevel(elevation)}
              </span>
              <span className={styles.count}>{count === 0 ? 'empty' : count}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

/**
 * The levels at the canvas edge: the level rows, the current level with ▲ / ▼ and a
 * field, the step, Tops (to the highest wall top here), Pick (the next click picks a
 * piece's top), the support view and (3D) which levels are drawn and the plate's frost.
 */
export const LevelsBar = () => {
  const ctx = useToolContext();
  const datum = useAtomValue(workDatumAtom);
  const [step, setStep] = useAtom(elevationStepAtom);
  const [picking, setPicking] = useAtom(levelPickAtom);
  const [supportView, setSupportView] = useAtom(supportViewAtom);
  const is3d = useViewMode() === '3d';
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
      <LevelRows levels={levels} datum={datum} />
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
      <div className={styles.actions}>
        <ToggleButton
          title="Colour pieces by structural support"
          pressed={supportView}
          onChange={setSupportView}
        >
          Support
        </ToggleButton>
      </div>
      {is3d && <LevelViewControls />}
    </div>
  );
};
