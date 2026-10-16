import { useAtomValue } from 'jotai';

import { underlayRect } from '../model/underlay';
import { useViewport, useViewportSize } from '../store/hooks';
import { useDisplayPlan } from '../store/planHooks';
import { underlayVisibleAtom } from '../store/session';
import { useUnderlayImage } from '../store/useUnderlayImage';
import { overlayTransform, worldToScreen } from '../viewport/viewportMath';

import styles from './Overlay.module.css';

/**
 * The reference image, in its own SVG under the (transparent) plan canvas, so the grid
 * and walls draw over it. A dashed box says "Image missing" when its blob is gone
 * (a file opened without the embedded image, or storage cleared).
 */
export const UnderlayLayer = () => {
  const underlay = useDisplayPlan().underlay;
  const visible = useAtomValue(underlayVisibleAtom);
  const viewport = useViewport();
  const size = useViewportSize();
  const image = useUnderlayImage(underlay?.imageId ?? null);
  if (!underlay || !visible) return null;
  const { min, max } = underlayRect(underlay);
  const box = { x: min.x, y: min.z, width: max.x - min.x, height: max.z - min.z };
  const label = worldToScreen(viewport, size, { x: (min.x + max.x) / 2, z: (min.z + max.z) / 2 });

  return (
    <svg className={styles.overlay} aria-hidden>
      <g transform={overlayTransform(viewport, size)}>
        {image.state === 'ready' && (
          <image href={image.url} {...box} preserveAspectRatio="none" opacity={underlay.opacity} />
        )}
        {image.state === 'missing' && (
          <rect className={styles.underlayMissing} {...box} vectorEffect="non-scaling-stroke" />
        )}
      </g>
      {image.state === 'missing' && (
        <text className={styles.labelSecondary} x={label.x} y={label.y} paintOrder="stroke">
          Image missing: relink it in the Underlay tool (U)
        </text>
      )}
    </svg>
  );
};
