import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { useCursor, useThemeTokens } from '../../store/hooks';
import { pxPerMetreAtom } from '../../store/pointer';

import { ARM_PX, crossAt, RING_PX } from './cursorShapes';
import { PlaneLines } from './PlaneLines';

/** Just over the surface, so the cross doesn't z-fight a floor's top. */
const CURSOR_LIFT = 0.01;

/**
 * A cross on the surface under the pointer at the snapped point, or (dashed) at the raw
 * one while Alt is held.
 */
export const SnapCursor3d = () => {
  const cursor = useCursor();
  const pxPerMetre = useAtomValue(pxPerMetreAtom);
  const { ink } = useThemeTokens();
  const at = cursor?.snapped;
  const lines = useMemo(
    () => (at ? crossAt(at, ARM_PX / pxPerMetre, RING_PX / pxPerMetre) : []),
    [at, pxPerMetre]
  );
  if (!cursor) return null;
  return (
    <group position-y={cursor.y + CURSOR_LIFT}>
      {cursor.snapping ? (
        <PlaneLines lines={lines} color={ink.accent} />
      ) : (
        <PlaneLines lines={lines} color={ink.info} dash={2 / pxPerMetre} />
      )}
    </group>
  );
};
