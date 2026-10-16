import { useAtomValue } from 'jotai';

import { formatArea, formatSize } from '../../format';
import { boxArea, boxSize } from '../../model/geometry/box';
import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';
import { getLibrary } from '../../store/libraryInstance';

import { floorPreviewAtom } from './floorState';

/** Gap (px) between the rectangle's top edge and its label. */
const LABEL_GAP = 14;
const LINE_HEIGHT = 16;

/** "6× Wood Floor 2x2 · 4× Wood Floor 1x1": tile counts, largest first. */
const tileSummary = (prefabs: readonly string[]): string => {
  const counts = new Map<string, number>();
  for (const prefab of prefabs) counts.set(prefab, (counts.get(prefab) ?? 0) + 1);
  return [...counts]
    .map(([prefab, n]) => `${n}× ${getLibrary().catalog.pieces.get(prefab)?.name ?? prefab}`)
    .join(' · ');
};

/** The dragged floor's size, area and tiles above it; the leftover warning below that. */
export const FloorPreview = () => {
  const preview = useAtomValue(floorPreviewAtom);
  const toScreen = useWorldToScreen();
  if (!preview) return null;

  const { box, family, split } = preview;
  const size = boxSize(box);
  const a = toScreen(box.min);
  const b = toScreen({ x: box.max.x, z: box.min.z });
  const x = (a.x + b.x) / 2;
  const y = a.y - LABEL_GAP;
  const tiles = split ? tileSummary(split.pieces.map((p) => p.prefab)) : '';
  const parts = [`${formatSize(size.x, size.z)} m`, formatArea(boxArea(box)), tiles].filter(
    Boolean
  );
  const leftover = split && split.leftover > 0 && family;

  return (
    <g>
      <text className={styles.label} x={x} y={leftover ? y - LINE_HEIGHT : y} paintOrder="stroke">
        {parts.join(' · ')}
      </text>
      {leftover && (
        <text className={`${styles.label} ${styles.labelWarn}`} x={x} y={y} paintOrder="stroke">
          {formatArea(split.leftover)} can&apos;t be tiled with {family.minTile}×{family.minTile}
        </text>
      )}
    </g>
  );
};
