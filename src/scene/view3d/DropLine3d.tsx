import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { groundHeight } from '../../model/build/buildHit';
import { useCursor, useThemeTokens } from '../../store/hooks';
import { pxPerMetreAtom } from '../../store/pointer';
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
/** Drawn only when the cursor is this far above (or below) the ground under it. */
const MIN_DROP = 0.1;

/**
 * With the cursor on a piece, a dashed vertical line from the snapped cursor at its
 * height down to the ground under it (the shown terrain's collider height, else y = 0),
 * with a ring where it lands: the cursor's height, read on the pieces it passes.
 * Absolute heights.
 */
export const DropLine3d = () => {
  const cursor = useCursor();
  const pxPerMetre = useAtomValue(pxPerMetreAtom);
  const { ink } = useThemeTokens();
  const site = useShownSiteTerrain();
  const invalidate = useThree((s) => s.invalidate);
  const [lines] = useState(() => createLines(true));
  // Without a cursor it is drawn collapsed at the origin, so it is never empty.
  const at = cursor?.snapped ?? ORIGIN;
  const ring = useMemo(() => [ringAt(at, (2 * RING_PX) / pxPerMetre)], [at, pxPerMetre]);
  const y = cursor?.y ?? 0;
  const ground = groundHeight({ terrain: site && { grid: site.grid, frame: site.frame } }, at);

  useEffect(() => () => disposeLines(lines), [lines]);

  useLayoutEffect(() => {
    setPositions(lines, [at.x, y, at.z, at.x, ground, at.z]);
    setStyle(lines, ink.info, DASH_PX / pxPerMetre);
    invalidate();
  }, [lines, at, y, ground, ink.info, pxPerMetre, invalidate]);

  return (
    <Collapsed shown={cursor?.on === 'piece' && Math.abs(y - ground) > MIN_DROP}>
      <primitive object={lines.hidden} renderOrder={HIDDEN_RENDER_ORDER} frustumCulled={false} />
      <primitive object={lines.visible} renderOrder={VISIBLE_RENDER_ORDER} frustumCulled={false} />
      <group position-y={ground}>
        <PlaneLines lines={ring} color={ink.info} />
      </group>
    </Collapsed>
  );
};
