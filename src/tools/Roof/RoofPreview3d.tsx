import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { ringBox } from '../../model/geometry/rings';
import { roofPieceBoxes } from '../../model/pieceBoxes';
import { Label3d } from '../../overlay/Label3d';
import styles from '../../overlay/Overlay.module.css';
import { GhostBoxes } from '../../scene/view3d/GhostBoxes';
import { PlaneLines } from '../../scene/view3d/PlaneLines';
import { useThemeTokens } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { workDatumAtom } from '../../store/session';

import { roofPreviewAtom } from './roofState';
import { ROOF_LABEL_GAP, ROOF_LINE_HEIGHT, roofPreviewLines } from './RoofWorldPreview';

/**
 * The roof a click would add: ghost pieces at their heights (on the walls below when it
 * rests on a lower level's), and its outline on the work plane.
 */
export const RoofPreview3d = () => {
  const preview = useAtomValue(roofPreviewAtom);
  const datum = useAtomValue(workDatumAtom);
  const { ink } = useThemeTokens();
  const boxes = useMemo(
    () => (preview ? roofPieceBoxes(preview.tiling.pieces, getLibrary()) : []),
    [preview]
  );
  const lines = useMemo(
    () => (preview ? [{ points: preview.roof.outline, closed: true }] : []),
    [preview]
  );
  if (!preview) return null;
  return (
    <>
      {/* The pieces stand at the roof's own elevation; the view lifts previews by the datum. */}
      <group position-y={-datum}>
        <GhostBoxes boxes={boxes} />
      </group>
      <PlaneLines lines={lines} color={ink.accent} />
    </>
  );
};

/** Its label over the outline's far edge, and what is wrong with it. */
export const RoofOverlay3d = () => {
  const preview = useAtomValue(roofPreviewAtom);
  if (!preview) return null;
  const { min, max } = ringBox(preview.roof.outline);
  const at = { x: (min.x + max.x) / 2, z: min.z };
  const lines = roofPreviewLines(preview);
  return (
    <g>
      {lines.map((line, i) => (
        <Label3d
          key={i}
          at={at}
          text={line.text}
          above={ROOF_LABEL_GAP + (lines.length - 1 - i) * ROOF_LINE_HEIGHT}
          className={line.warn ? `${styles.label} ${styles.labelWarn}` : styles.label}
        />
      ))}
    </g>
  );
};
