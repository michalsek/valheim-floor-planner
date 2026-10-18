import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { useCursor, useThemeTokens } from '../../store/hooks';
import { pxPerMetreAtom } from '../../store/session';

import { ARM_PX, crossAt, RING_PX } from './cursorShapes';
import { PlaneLines } from './PlaneLines';

/** A cross on the work plane at the snapped point, or (dashed) at the raw one while Alt is held. */
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
  return cursor.snapping ? (
    <PlaneLines lines={lines} color={ink.accent} />
  ) : (
    <PlaneLines lines={lines} color={ink.info} dash={2 / pxPerMetre} />
  );
};
