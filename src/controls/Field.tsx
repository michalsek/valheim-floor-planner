import type { ReactNode } from 'react';

import styles from './Controls.module.css';

interface FieldProps {
  label: string;
  /** Shown after the control, e.g. a unit. */
  suffix?: string;
  children: ReactNode;
}

/** An inline "Label [control] unit" group. */
export const Field = ({ label, suffix, children }: FieldProps) => (
  <div className={styles.field}>
    <span>{label}</span>
    {children}
    {suffix && <span>{suffix}</span>}
  </div>
);
