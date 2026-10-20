import type { ReactNode } from 'react';

import styles from './Overlay.module.css';

/**
 * The 3D view's SVG layer over the canvas, in screen CSS px: labels and constant-size
 * marks placed with `useProject3d`, each at the height its user sets (lines are drawn in
 * the scene). It never takes pointer events.
 */
export const Overlay3d = ({ children }: { children: ReactNode }) => (
  <svg className={styles.overlay} aria-hidden>
    {children}
  </svg>
);
