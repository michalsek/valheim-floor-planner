import { useAtomValue } from 'jotai';
import type { ReactNode } from 'react';

import { workDatumAtom } from '../store/session';

import styles from './Overlay.module.css';
import { OverlayPlaneContext } from './useProject3d';

/**
 * The 3D view's SVG layer over the canvas, in screen CSS px: labels and constant-size
 * marks placed with `useProject3d` on the work plane (lines are drawn in the scene). It
 * never takes pointer events.
 */
export const Overlay3d = ({ children }: { children: ReactNode }) => (
  <svg className={styles.overlay} aria-hidden>
    <OverlayPlaneContext value={useAtomValue(workDatumAtom)}>{children}</OverlayPlaneContext>
  </svg>
);
