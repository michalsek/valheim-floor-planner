import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { groundAt } from '../../model/terrain/siteTerrain';
import { useCursor, useThemeTokens } from '../../store/hooks';
import { pxPerMetreAtom, workDatumAtom } from '../../store/session';
import { useShownSiteTerrain } from '../../store/siteTerrain';

import { Collapsed } from './Collapsed';
import { RING_PX, ringAt } from './cursorShapes';
import {
  createLines,
  disposeLines,
  HIDDEN_RENDER_ORDER,
  setPositions,
  setStyle,
  VISIBLE_RENDER_ORDER,
} from './lineObjects';
import { PlaneLines } from './PlaneLines';

const ORIGIN = { x: 0, z: 0 };
/** Dash and gap length of the drop line, in screen px at the cursor. */
const DASH_PX = 4;
/** Drawn only when the work plane and the ground under the cursor are this far apart. */
const MIN_DROP = 0.1;

/**
 * Off the ground, a dashed vertical line from the snapped cursor on the work plane
 * to the ground under it (the terrain's collider height, or y = 0), with a ring where it
 * lands: the cursor's height, read on the pieces it passes. Inside the work-plane group
 * (y = 0 is the current level).
 */
export const DropLine3d = () => {
  const cursor = useCursor();
  const datum = useAtomValue(workDatumAtom);
  const pxPerMetre = useAtomValue(pxPerMetreAtom);
  const { ink } = useThemeTokens();
  const site = useShownSiteTerrain();
  const invalidate = useThree((s) => s.invalidate);
  const [lines] = useState(() => createLines(true));
  // Without a cursor it is drawn collapsed at the origin, so it is never empty.
  const at = cursor?.snapped ?? ORIGIN;
  const ring = useMemo(() => [ringAt(at, (2 * RING_PX) / pxPerMetre)], [at, pxPerMetre]);
  const ground = (site && groundAt(site.grid, site.frame, at)) ?? 0;
  // The ground relative to the work plane.
  const drop = ground - datum;

  useEffect(() => () => disposeLines(lines), [lines]);

  useLayoutEffect(() => {
    setPositions(lines, [at.x, 0, at.z, at.x, drop, at.z]);
    setStyle(lines, ink.info, DASH_PX / pxPerMetre);
    invalidate();
  }, [lines, at, drop, ink.info, pxPerMetre, invalidate]);

  return (
    <Collapsed shown={cursor !== null && Math.abs(drop) > MIN_DROP}>
      <primitive object={lines.hidden} renderOrder={HIDDEN_RENDER_ORDER} frustumCulled={false} />
      <primitive object={lines.visible} renderOrder={VISIBLE_RENDER_ORDER} frustumCulled={false} />
      <group position-y={drop}>
        <PlaneLines lines={ring} color={ink.info} />
      </group>
    </Collapsed>
  );
};
