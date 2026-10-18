import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { formatLevel } from '../format';
import type { WorldBox } from '../model/geometry/box';
import { plateRect } from '../scene/view3d/plateRect';
import { usePlateShown, usePreviewLevel, useShownBoxes } from '../scene/view3d/useLevelShading';
import { useCursor } from '../store/hooks';
import { useDisplayPlan } from '../store/planHooks';
import { projection3dAtom, workDatumAtom } from '../store/session';
import type { ScreenPoint } from '../viewport/viewportMath';

import { Label3d } from './Label3d';
import styles from './Overlay.module.css';
import { OverlayPlaneContext, useProject3d } from './useProject3d';

/**
 * Gap (px) between the plate's edge and its tag: below it for the current level, above
 * it for the previewed one (their outlines' lowest points are often close); and the
 * cursor's, above it.
 */
const CORNER_GAP = 12;
const CURSOR_GAP = 14;
/** Canvas margins the tag keeps clear of (px): the 3D view's bar is at the bottom. */
const MARGIN = { side: 16, top: 16, bottom: 72 } as const;

interface ScreenRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** The part of segment ab inside `rect` (Liang–Barsky), or null. */
const clipSegment = (a: ScreenPoint, b: ScreenPoint, rect: ScreenRect): ScreenPoint[] | null => {
  const d = { x: b.x - a.x, y: b.y - a.y };
  let t0 = 0;
  let t1 = 1;
  const edges: [number, number][] = [
    [-d.x, a.x - rect.minX],
    [d.x, rect.maxX - a.x],
    [-d.y, a.y - rect.minY],
    [d.y, rect.maxY - a.y],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
    } else if (p < 0) t0 = Math.max(t0, q / p);
    else t1 = Math.min(t1, q / p);
    if (t0 > t1) return null;
  }
  return [t0, t1].map((t) => ({ x: a.x + d.x * t, y: a.y + d.y * t }));
};

/**
 * The lowest point on screen (the nearest the viewer) of a closed outline's visible
 * part: a corner when one shows, else where an edge leaves the screen.
 */
const lowestVisible = (outline: (ScreenPoint | null)[], rect: ScreenRect): ScreenPoint | null => {
  let lowest: ScreenPoint | null = null;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const clipped = a && b ? clipSegment(a, b, rect) : null;
    for (const p of clipped ?? []) if (!lowest || p.y > lowest.y) lowest = p;
  });
  return lowest;
};

/** The level's height under the lowest visible point of the plate's edge. */
const CornerTag = ({
  rect,
  text,
  above = false,
}: {
  rect: WorldBox;
  text: string;
  above?: boolean;
}) => {
  const project = useProject3d();
  const projection = useAtomValue(projection3dAtom);
  if (!projection) return null;
  const { width, height } = projection.size;
  const corners = [
    rect.min,
    { x: rect.max.x, z: rect.min.z },
    rect.max,
    { x: rect.min.x, z: rect.max.z },
  ];
  const at = lowestVisible(
    corners.map((c) => project(c)),
    { minX: MARGIN.side, minY: MARGIN.top, maxX: width - MARGIN.side, maxY: height - MARGIN.bottom }
  );
  if (!at) return null;
  return (
    <text
      className={styles.plateTag}
      x={at.x}
      y={at.y + (above ? -CORNER_GAP : CORNER_GAP)}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
};

/**
 * The 3D view's level heights (`LevelPlate` draws the plates): wherever the plate is
 * shown (off the ground, and at every level over terrain), at its corner and over the
 * cursor; and at the previewed level's outline.
 */
export const LevelTags3d = () => {
  const datum = useAtomValue(workDatumAtom);
  const preview = usePreviewLevel();
  const cursor = useCursor();
  const { bounds } = useShownBoxes(useDisplayPlan());
  const rect = useMemo(() => plateRect(bounds), [bounds]);
  const raised = usePlateShown();
  return (
    <g>
      {raised && <CornerTag rect={rect} text={formatLevel(datum)} />}
      {raised && cursor && (
        <Label3d
          at={cursor.snapped}
          text={formatLevel(datum)}
          above={CURSOR_GAP}
          className={styles.plateTag}
        />
      )}
      {preview !== null && (
        <OverlayPlaneContext value={preview}>
          <CornerTag rect={rect} text={formatLevel(preview)} above />
        </OverlayPlaneContext>
      )}
    </g>
  );
};
