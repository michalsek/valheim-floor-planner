import type { ReactNode } from 'react';

import styles from './Controls.module.css';
import { keepFocus } from './keepFocus';

interface ButtonProps {
  title?: string;
  disabled?: boolean;
  onClick(): void;
  children: ReactNode;
}

/** A small bordered button that never takes focus. */
export const Button = ({ title, disabled = false, onClick, children }: ButtonProps) => (
  <button
    type="button"
    className={styles.button}
    title={title}
    disabled={disabled}
    onMouseDown={keepFocus}
    onClick={onClick}
  >
    {children}
  </button>
);
