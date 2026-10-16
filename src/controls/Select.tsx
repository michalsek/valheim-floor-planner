import styles from './Controls.module.css';

interface SelectProps {
  label: string;
  options: readonly { value: string; label: string; disabled?: boolean }[];
  value: string;
  onChange(value: string): void;
}

/** A native select that gives focus back after a change, so shortcuts keep working. */
export const Select = ({ label, options, value, onChange }: SelectProps) => (
  <select
    className={styles.select}
    aria-label={label}
    value={value}
    onChange={(e) => {
      onChange(e.currentTarget.value);
      e.currentTarget.blur();
    }}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value} disabled={option.disabled ?? false}>
        {option.label}
      </option>
    ))}
  </select>
);
