import { useMemo } from 'react';

import { propRadius } from '../../catalog/stations';
import type { Prop } from '../../model/types';
import { useThemeTokens } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';

import { PlaneLines } from './PlaneLines';

const RING_SEGMENTS = 96;
/** Dash and gap length (metres) of the ring. */
const RING_DASH = 0.6;

/**
 * A station's build radius or the ward's, as a dashed circle on the work plane about
 * the prop's pivot (nothing for other props).
 */
export const GroundRing = ({ prop }: { prop: Pick<Prop, 'prefab' | 'position' | 'upgrades'> }) => {
  const { ink } = useThemeTokens();
  const radius = propRadius(prop.prefab, prop.upgrades, getLibrary().catalog);
  const r = radius?.radius ?? 0;
  const { x, z } = prop.position;
  const lines = useMemo(() => {
    const points = Array.from({ length: RING_SEGMENTS }, (_, i) => {
      const a = (i / RING_SEGMENTS) * Math.PI * 2;
      return { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r };
    });
    return [{ points, closed: true }];
  }, [x, z, r]);
  if (!radius) return null;
  return (
    <PlaneLines
      lines={lines}
      color={radius.kind === 'ward' ? ink.pinned : ink.accent}
      dash={RING_DASH}
    />
  );
};
