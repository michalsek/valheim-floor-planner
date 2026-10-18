import styles from './Controls.module.css';
import { keepFocus } from './keepFocus';

interface SegmentedControlProps<T> {
  /** The group's accessible name. */
  label: string;
  options: readonly { value: T; label: string; title?: string }[];
  value: T;
  onChange(value: T): void;
  /** Added to the group's class, e.g. for a tighter row. */
  className?: string | undefined;
}

/** A row of mutually exclusive buttons that never take focus from a click. */
export const SegmentedControl = <T extends string | number>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) => (
  <div
    className={className ? `${styles.segments} ${className}` : styles.segments}
    role="group"
    aria-label={label}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        className={
          option.value === value ? `${styles.segment} ${styles.segmentActive}` : styles.segment
        }
        aria-pressed={option.value === value}
        title={option.title}
        onMouseDown={keepFocus}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);
