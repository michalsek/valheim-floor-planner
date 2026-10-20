import { useRef, useState } from 'react';

import styles from './Controls.module.css';

interface NumberInputProps {
  label: string;
  /** Null shows an empty field (with `placeholder`). */
  value: number | null;
  /** What ArrowUp / ArrowDown add or take away. */
  step: number;
  placeholder?: string;
  /** Called with a finite number on Enter or blur, when it changed. */
  onCommit(value: number): void;
}

const draftOf = (value: number | null): string => (value === null ? '' : String(value));

/**
 * The number in a draft: a decimal point or comma, and a typographic minus, are taken;
 * null when it isn't one.
 */
const parseDraft = (draft: string): number | null => {
  const text = draft.trim().replace(',', '.').replace('−', '-');
  const n = Number(text);
  return text === '' || !Number.isFinite(n) ? null : n;
};

/**
 * A number field that commits on Enter or blur; Esc, an empty field and invalid input
 * revert. ArrowUp / ArrowDown step the draft. It is a text field, so it shows a decimal
 * point as every label does, whatever the browser's locale. Mount it keyed by `value`, so
 * an undone change shows. After a commit the field shows `value` again until the new one
 * arrives, so a refused or clamped entry doesn't linger.
 */
export const NumberInput = ({ label, value, step, placeholder, onCommit }: NumberInputProps) => {
  const [draft, setDraft] = useState(draftOf(value));
  const reverting = useRef(false);

  const commit = () => {
    const next = parseDraft(draft);
    if (!reverting.current && next !== null && next !== value) onCommit(next);
    setDraft(draftOf(value));
    reverting.current = false;
  };

  const stepDraft = (dir: 1 | -1) => {
    const from = parseDraft(draft) ?? value ?? 0;
    // To the millimetre, without float noise (0.1 + 0.2).
    setDraft(String(Math.round((from + dir * step) * 1000) / 1000));
  };

  return (
    <input
      className={styles.number}
      type="text"
      inputMode="decimal"
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          stepDraft(e.key === 'ArrowUp' ? 1 : -1);
        }
        if (e.key === 'Escape') reverting.current = true;
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
    />
  );
};
