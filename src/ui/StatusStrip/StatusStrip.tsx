import { catalog, wallFamilies } from '../../catalog';
import { formatNumber, formatZoom } from '../../format';
import { useCursor, useRendererBackend, useViewport } from '../../store/hooks';

import { SnapStepPicker } from './SnapStepPicker';
import styles from './StatusStrip.module.css';

export const StatusStrip = () => {
  const cursor = useCursor();
  const { zoom } = useViewport();
  const backend = useRendererBackend();

  return (
    <footer className={styles.strip}>
      <span className={styles.coords}>
        {cursor
          ? `x ${formatNumber(cursor.snapped.x)}  z ${formatNumber(cursor.snapped.z)} m`
          : '—'}
      </span>
      <span>{formatZoom(zoom)}</span>
      <SnapStepPicker />
      <span className={styles.spacer} />
      <span className={styles.debug}>
        {catalog.pieces.size} pieces · {wallFamilies.length} wall families
      </span>
      <span className={styles.badge}>{backend === 'pending' ? '…' : backend}</span>
    </footer>
  );
};
