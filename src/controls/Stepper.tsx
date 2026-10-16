import styles from './Controls.module.css';
import { keepFocus } from './keepFocus';

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange(value: number): void;
}

/** − value + buttons for a small whole number; never takes focus. */
export const Stepper = ({ label, value, min, max, onChange }: StepperProps) => (
  <div className={styles.segments} role="group" aria-label={label}>
    <button
      type="button"
      className={styles.segment}
      aria-label={`Fewer ${label.toLowerCase()}`}
      disabled={value <= min}
      onMouseDown={keepFocus}
      onClick={() => onChange(value - 1)}
    >
      −
    </button>
    <span className={styles.stepperValue}>{value}</span>
    <button
      type="button"
      className={styles.segment}
      aria-label={`More ${label.toLowerCase()}`}
      disabled={value >= max}
      onMouseDown={keepFocus}
      onClick={() => onChange(value + 1)}
    >
      +
    </button>
  </div>
);
