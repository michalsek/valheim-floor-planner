import type { ReactNode } from 'react';

import styles from './Controls.module.css';
import { keepFocus } from './keepFocus';

interface ButtonProps {
  title?: string;
  onClick(): void;
  children: ReactNode;
}

/** A small bordered button that never takes focus. */
export const Button = ({ title, onClick, children }: ButtonProps) => (
  <button
    type="button"
    className={styles.button}
    title={title}
    onMouseDown={keepFocus}
    onClick={onClick}
  >
    {children}
  </button>
);
