/**
 * SVG layer over the 3D canvas (adapted from yummies `canvas/overlay/Overlay`). It
 * never takes pointer events; `ToolHost` owns them.
 *
 * - The world layer is authored in metres; its transform follows the viewport, so
 *   strokes there must use `vector-effect="non-scaling-stroke"`.
 * - The screen layer is authored in CSS px, for constant-size marks and text.
 */
import type { ReactNode } from 'react';

import { useViewport, useViewportSize } from '../store/hooks';
import { overlayTransform } from '../viewport/viewportMath';

import styles from './Overlay.module.css';
import { SiteMarks } from './SiteMarks';

export interface OverlayProps {
  /** Content in world metres. */
  world?: ReactNode;
  /** Content in screen CSS px. */
  children?: ReactNode;
}

export const Overlay = ({ world, children }: OverlayProps) => {
  const viewport = useViewport();
  const size = useViewportSize();

  return (
    <svg className={styles.overlay} aria-hidden>
      <g data-layer="world" transform={overlayTransform(viewport, size)}>
        {/* Under everything drawn on the plan: the site's patch edge and location rings. */}
        <SiteMarks />
        {world}
      </g>
      <g data-layer="screen">{children}</g>
    </svg>
  );
};
