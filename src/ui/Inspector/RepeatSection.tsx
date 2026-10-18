import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { NumberInput } from '../../controls/NumberInput';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { formatMetres } from '../../format';
import type { PlanCommand } from '../../model/commands';
import { newId } from '../../model/newId';
import {
  MAX_REPEAT,
  MIN_REPEAT,
  repeatCommands,
  repeatLabel,
  setSnapExtent,
  type RepeatAxis,
} from '../../model/pieceOps/repeat';
import type { SelectionItem } from '../../model/selection';
import { getLibrary } from '../../store/libraryInstance';
import { usePlan } from '../../store/planHooks';
import { editPreviewAtom, selectionAtom } from '../../store/selection';
import { commitCommands } from '../../tools/Select/selectActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './Inspector.module.css';

const AXES = [
  { value: 'along', label: 'Along', title: 'Along the first piece (its length)' },
  { value: 'across', label: 'Across', title: 'Across the first piece (its thickness)' },
  { value: 'up', label: 'Up', title: 'Upwards' },
] as const satisfies readonly { value: RepeatAxis; label: string; title: string }[];

const SIGNS: readonly { value: 1 | -1; label: string; title: string }[] = [
  { value: 1, label: '+', title: 'Forwards along that way' },
  { value: -1, label: '−', title: 'Backwards along that way' },
];

const clampCount = (n: number) => Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Math.round(n)));

/**
 * Repeat for raw pieces (M17 §7.3): the row's count (the selection included), its way
 * and step (by default the selection's snap extent that way). While open, the copies
 * show through `editPreviewAtom`; Apply commits them as one entry and selects the row.
 * Another edit preview (a drag in Select) closes it.
 */
export const RepeatSection = ({ raws }: { raws: readonly SelectionItem[] }) => {
  const ctx = useToolContext();
  const plan = usePlan();
  const preview = useAtomValue(editPreviewAtom);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(5);
  const [axis, setAxis] = useState<RepeatAxis>('along');
  const [sign, setSign] = useState<1 | -1>(1);
  const [typedStep, setTypedStep] = useState<number | null>(null);
  const ours = useRef<readonly PlanCommand[] | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  // Worked out once the section opens, not for every selection.
  const defaultStep = useMemo(
    () => (open ? setSnapExtent(plan, raws, axis, getLibrary()) : 0),
    [open, plan, raws, axis]
  );
  const step = typedStep ?? defaultStep;
  const valid = step > 0;

  useEffect(() => {
    if (!open || !valid) return;
    const { cmds } = repeatCommands(plan, raws, { count, axis, sign, step }, newId);
    ours.current = cmds;
    ctx.set(editPreviewAtom, cmds);
    return () => {
      if (ctx.get(editPreviewAtom) === ours.current) ctx.set(editPreviewAtom, null);
      ours.current = null;
    };
  }, [ctx, open, valid, plan, raws, count, axis, sign, step]);

  // The Inspector scrolls: show the fields once open.
  useEffect(() => {
    if (open) groupRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open]);

  // Something else took the preview over (a drag, a click on the canvas): close.
  useEffect(() => {
    if (open && ours.current && ctx.get(editPreviewAtom) !== ours.current) setOpen(false);
  }, [ctx, open, preview]);

  if (!open) {
    return (
      <Button
        title="Copies of the selection in a row, previewed before they're added"
        onClick={() => setOpen(true)}
      >
        Repeat…
      </Button>
    );
  }

  const apply = () => {
    const copy = repeatCommands(ctx.plan.getPlan(), raws, { count, axis, sign, step }, newId);
    ours.current = null;
    ctx.set(editPreviewAtom, null);
    if (commitCommands(ctx, repeatLabel(raws.length, count), copy.cmds)) {
      ctx.set(selectionAtom, [...raws, ...copy.items]);
    }
    setOpen(false);
  };

  return (
    <div ref={groupRef} className={styles.repeat} role="group" aria-label="Repeat">
      <Field label="Count">
        <NumberInput
          key={count}
          label={`Pieces in the row, the selection included (${MIN_REPEAT}–${MAX_REPEAT})`}
          value={count}
          step={1}
          onCommit={(n) => setCount(clampCount(n))}
        />
      </Field>
      <Field label="Way">
        <SegmentedControl
          label="Which way the row goes"
          options={AXES}
          value={axis}
          onChange={(next) => {
            setAxis(next);
            setTypedStep(null);
          }}
        />
      </Field>
      <Field label="Direction">
        <SegmentedControl<1 | -1>
          label="Direction"
          options={SIGNS}
          value={sign}
          onChange={setSign}
        />
      </Field>
      <Field label="Step" suffix="m">
        <NumberInput
          key={step}
          label="Metres between copies"
          value={step}
          step={0.5}
          onCommit={(n) => setTypedStep(n > 0 ? n : null)}
        />
        {typedStep !== null && (
          <Button
            title={`The snap extent: ${formatMetres(defaultStep)}`}
            onClick={() => setTypedStep(null)}
          >
            Reset
          </Button>
        )}
      </Field>
      <p className={styles.info}>
        {valid
          ? `Adds ${count - 1} ${count === 2 ? 'copy' : 'copies'}, ${formatMetres(step)} apart`
          : 'No extent that way: type a step'}
      </p>
      <div className={styles.actionRow}>
        <Button disabled={!valid} title={repeatLabel(raws.length, count)} onClick={apply}>
          Apply
        </Button>
        <Button title="Close without adding copies" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
