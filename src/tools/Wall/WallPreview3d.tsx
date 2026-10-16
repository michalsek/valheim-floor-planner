import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { wallPieceBoxes } from '../../model/pieceBoxes';
import { DimensionLabel3d } from '../../overlay/DimensionLabel3d';
import { Marker3d } from '../../overlay/Marker3d';
import styles from '../../overlay/Overlay.module.css';
import { GhostBoxes } from '../../scene/view3d/GhostBoxes';
import { PlaneLines } from '../../scene/view3d/PlaneLines';
import { useThemeTokens } from '../../store/hooks';

import { CLOSE_RING_RADIUS, VERTEX_RADIUS } from './wallMarks';
import { wallPreviewAtom } from './wallPreviewAtom';

/** Dash length (metres) of a block wall's drawn line, whose face rather than centre is on it. */
const BLOCK_LINE_DASH = 0.25;

/** The wall being drawn, as ghost pieces at their real heights, and its drawn line. */
export const WallPreview3d = () => {
  const preview = useAtomValue(wallPreviewAtom);
  const { ink } = useThemeTokens();
  const pieces = preview?.pieces;
  const run = preview?.run;
  const boxes = useMemo(() => wallPieceBoxes(pieces ?? []), [pieces]);
  const lines = useMemo(() => (run ? [run] : []), [run]);
  if (!run) return null;
  const isBlock = preview.family?.snapKind === 'face';
  return (
    <>
      <GhostBoxes boxes={boxes} />
      <PlaneLines lines={lines} color={ink.accent} dash={isBlock ? BLOCK_LINE_DASH : undefined} />
    </>
  );
};

/** Screen marks for the wall being drawn: vertices, the close ring and the live length. */
export const WallOverlay3d = () => {
  const preview = useAtomValue(wallPreviewAtom);
  if (!preview) return null;
  const live = preview.liveSegment;
  return (
    <g>
      {live && <DimensionLabel3d a={live.a} b={live.b} />}
      {preview.points.map((p, i) => (
        <Marker3d key={i} at={p} r={VERTEX_RADIUS} className={styles.vertex} />
      ))}
      {preview.canClose && (
        <Marker3d at={preview.points[0]} r={CLOSE_RING_RADIUS} className={styles.closeRing} />
      )}
    </g>
  );
};
