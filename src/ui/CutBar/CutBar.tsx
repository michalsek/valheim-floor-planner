import { useAtom, useAtomValue } from 'jotai';

import { Button } from '../../controls/Button';
import { NumberInput } from '../../controls/NumberInput';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { ToggleButton } from '../../controls/ToggleButton';
import { useViewMode } from '../../store/hooks';
import { getStoreyStops, usePlan } from '../../store/planHooks';
import { cutHeightAtom, cutStepAtom, supportViewAtom, type CutStep } from '../../store/session';
import { setCut, stepCut, toggleAll } from '../../tools/cutActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './CutBar.module.css';
import { CutSlider } from './CutSlider';
import { GhostControls } from './GhostControls';
import { StopList } from './StopList';

const STEPS: readonly { value: CutStep; label: string }[] = [
  { value: 1, label: '1 m' },
  { value: 0.5, label: '0.5 m' },
];

/**
 * The cut at the canvas edge: the cut height H with ▲ / ▼ and a field (empty at All),
 * a slider over the plan's heights, All (C), the step, the storey stops, the support
 * view and (3D) the ghosts and their frost.
 */
export const CutBar = () => {
  const ctx = useToolContext();
  const h = useAtomValue(cutHeightAtom);
  const [step, setStep] = useAtom(cutStepAtom);
  const [supportView, setSupportView] = useAtom(supportViewAtom);
  const is3d = useViewMode() === '3d';
  const stops = getStoreyStops(usePlan());

  return (
    <div className={styles.bar} role="toolbar" aria-label="Cut">
      <div className={styles.current}>
        <Button
          title={h === null ? 'Showing everything' : 'Cut a step higher (PageUp)'}
          disabled={h === null}
          onClick={() => stepCut(ctx, 1)}
        >
          ▲
        </Button>
        <NumberInput
          key={h ?? 'all'}
          label="Cut height in metres"
          value={h}
          step={step}
          placeholder="All"
          onCommit={(next) => setCut(ctx, next)}
        />
        <Button title="Cut a step lower (PageDown)" onClick={() => stepCut(ctx, -1)}>
          ▼
        </Button>
      </div>
      <CutSlider />
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
      {stops.length > 0 && <StopList stops={stops} h={h} />}
      <div className={styles.actions}>
        <ToggleButton
          title="Colour pieces by structural support"
          pressed={supportView}
          onChange={setSupportView}
        >
          Support
        </ToggleButton>
      </div>
      {is3d && <GhostControls />}
    </div>
  );
};
