import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import type { Polyline } from '../../model/geometry/box';
import type { Vec2 } from '../../model/types';
import { useCursor, useThemeTokens } from '../../store/hooks';
import { pxPerMetreAtom } from '../../store/session';

import { PlaneLines } from './PlaneLines';

/** Arm length and centre ring radius, in screen px at the cursor (as in 2D). */
const ARM_PX = 10;
const RING_PX = 3;
const RING_SEGMENTS = 12;

const crossAt = (p: Vec2, arm: number, ring: number): Polyline[] => [
  {
    points: [
      { x: p.x - arm, z: p.z },
      { x: p.x + arm, z: p.z },
    ],
    closed: false,
  },
  {
    points: [
      { x: p.x, z: p.z - arm },
      { x: p.x, z: p.z + arm },
    ],
    closed: false,
  },
  {
    points: Array.from({ length: RING_SEGMENTS }, (_, i) => {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      return { x: p.x + Math.cos(a) * ring, z: p.z + Math.sin(a) * ring };
    }),
    closed: true,
  },
];

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
