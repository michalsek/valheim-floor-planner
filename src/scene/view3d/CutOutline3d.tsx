import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { boxOutline, type WorldBox } from '../../model/geometry/box';
import type { Bounds3 } from '../../model/geometry/bounds3';
import { useThemeTokens } from '../../store/hooks';
import { cutHeightAtom } from '../../store/session';

import { Collapsed } from './Collapsed';
import { cutRect } from './cutRect';
import { PlaneLines } from './PlaneLines';

/** Drawn (collapsed) while nothing shows, so the lines are never empty. */
const NOTHING: WorldBox = { min: { x: 0, z: 0 }, max: { x: 0, z: 0 } };

/**
 * Where the cut is: a thin accent rectangle at H just around the shown pieces
 * (`cutRect`), collapsed at All and while nothing shows.
 */
export const CutOutline3d = ({ bounds }: { bounds: Bounds3 | null }) => {
  const h = useAtomValue(cutHeightAtom);
  const { ink } = useThemeTokens();
  const rect = useMemo(() => cutRect(bounds), [bounds]);
  const lines = useMemo(() => [boxOutline(rect ?? NOTHING)], [rect]);
  return (
    <group position-y={h ?? 0}>
      <Collapsed shown={h !== null && rect !== null}>
        <PlaneLines lines={lines} color={ink.accent} />
      </Collapsed>
    </group>
  );
};
