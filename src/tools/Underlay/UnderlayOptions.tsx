import { useAtom, useAtomValue } from 'jotai';
import { useRef, useState } from 'react';

import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { ToggleButton } from '../../controls/ToggleButton';
import { fileStatusAtom } from '../../store/fileActions';
import { pickFile } from '../../store/files';
import { useDisplayPlan } from '../../store/planHooks';
import { editPreviewAtom } from '../../store/selection';
import { embedUnderlayAtom, underlayVisibleAtom } from '../../store/session';
import { useToolContext } from '../toolContext';

import styles from './UnderlayOptions.module.css';
import { applyCalibration, cancelUnderlayGesture, loadUnderlayImage } from './underlayActions';
import { snapAnchorAtom, underlayGestureAtom, underlayHintAtom } from './underlayState';

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const LoadButton = ({ relink }: { relink: boolean }) => {
  const ctx = useToolContext();
  const load = async () => {
    const file = await pickFile('image/*');
    if (!file) return;
    try {
      await loadUnderlayImage(ctx, file);
      ctx.set(fileStatusAtom, null);
    } catch (error) {
      ctx.set(fileStatusAtom, { tone: 'error', message: messageOf(error) });
    }
  };
  return (
    <Button title="Pick a reference image to trace over" onClick={() => void load()}>
      {relink ? 'Relink image…' : 'Load image…'}
    </Button>
  );
};

/**
 * Opacity, previewed while it changes and committed on pointer or key release (one
 * history entry per drag or key press). It keeps focus, so arrow keys go on working.
 */
const OpacitySlider = ({ value }: { value: number }) => {
  const ctx = useToolContext();
  const draft = useRef<number | null>(null);
  const commit = () => {
    const opacity = draft.current;
    draft.current = null;
    if (opacity === null) return;
    ctx.set(editPreviewAtom, null);
    ctx.plan.dispatch(
      { type: 'underlay.patch', changes: { opacity } },
      { label: 'Set underlay opacity' }
    );
  };
  return (
    <input
      type="range"
      aria-label="Underlay opacity"
      min={0}
      max={1}
      step={0.05}
      value={value}
      onChange={(e) => {
        draft.current = Number(e.currentTarget.value);
        ctx.set(editPreviewAtom, [{ type: 'underlay.patch', changes: { opacity: draft.current } }]);
      }}
      onPointerUp={commit}
      onKeyUp={commit}
      onBlur={commit}
    />
  );
};

interface DistanceFieldProps {
  onApply(metres: number): boolean;
  onCancel(): void;
}

/** The distance between the two calibration points: Enter applies, Esc cancels. */
const DistanceField = ({ onApply, onCancel }: DistanceFieldProps) => {
  const [text, setText] = useState('');
  const [snapAnchor, setSnapAnchor] = useAtom(snapAnchorAtom);
  const metres = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(metres) && metres > 0;
  return (
    <>
      <Field label="A to B" suffix="m">
        <input
          className={styles.metres}
          type="number"
          min={0}
          step="any"
          aria-label="Distance from A to B in metres"
          autoFocus
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid && onApply(metres)) e.currentTarget.blur();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </Field>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={snapAnchor}
          onChange={(e) => setSnapAnchor(e.currentTarget.checked)}
        />
        Snap A to grid
      </label>
      <Button disabled={!valid} onClick={() => onApply(metres)}>
        Apply
      </Button>
    </>
  );
};

const HIDDEN_HINT = 'Hidden: show it in the status bar to move or calibrate it';

const CALIB_PROMPTS = {
  calibA: 'Click point A on the image',
  calibB: 'Click point B, a known distance from A',
} as const;

/**
 * The underlay's settings: load or relink the image, opacity, lock, calibrate, remove,
 * and whether saves embed the image. During calibration, the step's prompt.
 */
export const UnderlayOptions = () => {
  const ctx = useToolContext();
  const underlay = useDisplayPlan().underlay;
  const [gesture, setGesture] = useAtom(underlayGestureAtom);
  const hint = useAtomValue(underlayHintAtom);
  const [embed, setEmbed] = useAtom(embedUnderlayAtom);
  const visible = useAtomValue(underlayVisibleAtom);
  if (!underlay) return <LoadButton relink={false} />;
  const message = visible ? hint : HIDDEN_HINT;

  if (
    gesture.phase === 'calibA' ||
    gesture.phase === 'calibB' ||
    gesture.phase === 'calibDistance'
  ) {
    return (
      <>
        {gesture.phase === 'calibDistance' ? (
          <DistanceField
            onApply={(m) => applyCalibration(ctx, gesture.a, gesture.b, m)}
            onCancel={() => cancelUnderlayGesture(ctx)}
          />
        ) : (
          <span>{CALIB_PROMPTS[gesture.phase]}</span>
        )}
        {message && <span className={styles.hint}>{message}</span>}
        <Button title="Esc" onClick={() => cancelUnderlayGesture(ctx)}>
          Cancel
        </Button>
      </>
    );
  }

  return (
    <>
      <span className={styles.name} title={underlay.name}>
        {underlay.name || 'Image'}
      </span>
      <LoadButton relink />
      <Field label="Opacity">
        <OpacitySlider value={underlay.opacity} />
      </Field>
      <ToggleButton
        title="A locked underlay can't be moved or calibrated"
        pressed={underlay.locked}
        onChange={(locked) =>
          ctx.plan.dispatch(
            { type: 'underlay.patch', changes: { locked } },
            { label: locked ? 'Lock underlay' : 'Unlock underlay' }
          )
        }
      >
        Lock
      </ToggleButton>
      <Button
        title="Click two points a known distance apart, then type the distance"
        disabled={underlay.locked || !visible}
        onClick={() => setGesture({ phase: 'calibA' })}
      >
        Calibrate…
      </Button>
      <ToggleButton
        title="Put the image in saved plan files (bigger files)"
        pressed={embed}
        onChange={setEmbed}
      >
        Save image in file
      </ToggleButton>
      <Button
        title="Remove the underlay (undoable)"
        onClick={() =>
          ctx.plan.dispatch({ type: 'underlay.set', underlay: null }, { label: 'Remove underlay' })
        }
      >
        Remove
      </Button>
      {message && <span className={styles.hint}>{message}</span>}
    </>
  );
};
