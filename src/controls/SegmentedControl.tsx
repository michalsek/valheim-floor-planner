import styles from './Controls.module.css';
import { keepFocus } from './keepFocus';

interface SegmentedControlProps<T> {
  /** The group's accessible name. */
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}

/** A row of mutually exclusive buttons that never take focus from a click. */
export const SegmentedControl = <T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) => (
  <div className={styles.segments} role="group" aria-label={label}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={
          option.value === value ? `${styles.segment} ${styles.segmentActive}` : styles.segment
        }
        aria-pressed={option.value === value}
        onMouseDown={keepFocus}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);
