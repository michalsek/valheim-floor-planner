import { useRef, useState } from 'react';

import styles from './Controls.module.css';

interface NumberInputProps {
  label: string;
  value: number;
  step: number;
  /** Called with a finite number on Enter or blur, when it changed. */
  onCommit(value: number): void;
}

/**
 * A number field that commits on Enter or blur; Esc and invalid input revert. Mount
 * it keyed by `value`, so an undone change shows. After a commit the field shows `value`
 * again until the new one arrives, so a refused or clamped entry doesn't linger.
 */
export const NumberInput = ({ label, value, step, onCommit }: NumberInputProps) => {
  const [draft, setDraft] = useState(String(value));
  const reverting = useRef(false);

  const commit = () => {
    const next = Number(draft);
    if (!reverting.current && draft.trim() !== '' && Number.isFinite(next) && next !== value) {
      onCommit(next);
    }
    setDraft(String(value));
    reverting.current = false;
  };

  return (
    <input
      className={styles.number}
      type="number"
      aria-label={label}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') reverting.current = true;
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
    />
  );
};
