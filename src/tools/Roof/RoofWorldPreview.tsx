import { useAtomValue } from 'jotai';

import { formatLevel } from '../../format';
import { ringBox } from '../../model/geometry/rings';
import styles from '../../overlay/Overlay.module.css';
import { RoofShape } from '../../overlay/RoofLayer';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';

import { roofPreviewAtom, roofPreviewLabel, type RoofPreview as Preview } from './roofState';

/** Gap (px) between the eave ring's top edge and the label, and between lines. */
export const ROOF_LABEL_GAP = 14;
export const ROOF_LINE_HEIGHT = 16;

/**
 * The label's lines: size, pitch, kind and pieces, the lower level it rests on, then what
 * is wrong (in red).
 */
export const roofPreviewLines = (preview: Preview): { text: string; warn: boolean }[] => [
  { text: roofPreviewLabel(preview), warn: preview.problem !== null },
  ...(preview.seatedOn === null
    ? []
    : [{ text: `On the ${formatLevel(preview.seatedOn)} walls`, warn: false }]),
  ...preview.tiling.warnings
    .filter((w) => w.level === 'warning')
    .map((w) => ({ text: w.message, warn: true })),
];

/** The roof a click would add: its lines and slope arrows (world layer). */
export const RoofWorldPreview = () => {
  const preview = useAtomValue(roofPreviewAtom);
  if (!preview) return null;
  return <RoofShape roof={preview.roof} className={styles.roofGhost} />;
};

/** Its label over the eave ring's top edge (screen layer). */
export const RoofPreview = () => {
  const preview = useAtomValue(roofPreviewAtom);
  const toScreen = useWorldToScreen();
  if (!preview) return null;
  const { min, max } = ringBox(preview.roof.outline);
  const a = toScreen({ x: (min.x + max.x) / 2, z: min.z });
  const lines = roofPreviewLines(preview);
  return (
    <g>
      {lines.map((line, i) => (
        <text
          key={i}
          className={line.warn ? `${styles.label} ${styles.labelWarn}` : styles.label}
          x={a.x}
          y={a.y - ROOF_LABEL_GAP - (lines.length - 1 - i) * ROOF_LINE_HEIGHT}
          paintOrder="stroke"
        >
          {line.text}
        </text>
      ))}
    </g>
  );
};
