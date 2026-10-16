import { useAtomValue } from 'jotai';

import { DimensionLine } from '../../overlay/DimensionLine';
import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';

import { wallPreviewAtom } from './wallPreviewAtom';

const VERTEX_RADIUS = 3.5;
const CLOSE_RING_RADIUS = 9;

/** Screen-space marks for the wall being drawn: vertices, live length, close ring. */
export const WallPreview = () => {
  const preview = useAtomValue(wallPreviewAtom);
  const toScreen = useWorldToScreen();
  if (!preview) return null;

  const start = toScreen(preview.points[0]);
  return (
    <g>
      {preview.liveSegment && (
        <DimensionLine a={preview.liveSegment.a} b={preview.liveSegment.b} showDelta={false} />
      )}
      {preview.points.map((p, i) => {
        const s = toScreen(p);
        return <circle key={i} className={styles.vertex} cx={s.x} cy={s.y} r={VERTEX_RADIUS} />;
      })}
      {preview.canClose && (
        <circle className={styles.closeRing} cx={start.x} cy={start.y} r={CLOSE_RING_RADIUS} />
      )}
    </g>
  );
};
