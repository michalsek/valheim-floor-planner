import type { ReactNode } from 'react';

import styles from './Controls.module.css';
import { keepFocus } from './keepFocus';

interface ToggleButtonProps {
  title?: string;
  pressed: boolean;
  /** 'pill' for filter chips. */
  variant?: 'button' | 'pill';
  onChange(pressed: boolean): void;
  children: ReactNode;
}

/** An on/off button that never takes focus. */
export const ToggleButton = ({
  title,
  pressed,
  variant = 'button',
  onChange,
  children,
}: ToggleButtonProps) => (
  <button
    type="button"
    className={[styles.toggle, variant === 'pill' && styles.pill, pressed && styles.toggleOn]
      .filter(Boolean)
      .join(' ')}
    title={title}
    aria-pressed={pressed}
    onMouseDown={keepFocus}
    onClick={() => onChange(!pressed)}
  >
    {children}
  </button>
);
