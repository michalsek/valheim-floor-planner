import styles from './Controls.module.css';
import { keepFocus } from './keepFocus';

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** How much a click changes the value (default 1). */
  step?: number;
  /** How the value is shown (default as it is). */
  format?: (value: number) => string;
  onChange(value: number): void;
}

/** − value + buttons for a small number; never takes focus. */
export const Stepper = ({
  label,
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
}: StepperProps) => (
  <div className={styles.segments} role="group" aria-label={label}>
    <button
      type="button"
      className={styles.segment}
      aria-label={`Fewer ${label.toLowerCase()}`}
      disabled={value <= min}
      onMouseDown={keepFocus}
      onClick={() => onChange(Math.max(min, value - step))}
    >
      −
    </button>
    <span className={styles.stepperValue}>{format(value)}</span>
    <button
      type="button"
      className={styles.segment}
      aria-label={`More ${label.toLowerCase()}`}
      disabled={value >= max}
      onMouseDown={keepFocus}
      onClick={() => onChange(Math.min(max, value + step))}
    >
      +
    </button>
  </div>
);
