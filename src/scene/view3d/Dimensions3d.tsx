import { useMemo } from 'react';

import { dimensionLine } from '../../model/geometry/dimension';
import type { Polyline } from '../../model/geometry/box';
import type { Vec2 } from '../../model/types';
import type { DimensionTone } from '../../overlay/DimensionLine';
import { useDimensionTone } from '../../overlay/useDimensionTone';
import { useThemeTokens } from '../../store/hooks';
import { useCutPlan } from '../../store/planHooks';
import type { ThemeTokens } from '../../theme/themeTokens';

import { PlaneLines } from './PlaneLines';

const toneColor = (tone: DimensionTone, { ink, selection }: ThemeTokens): string => {
  switch (tone) {
    case 'live':
      return ink.accent;
    case 'pinned':
      return ink.pinned;
    case 'danger':
      return ink.danger;
    case 'selected':
    case 'hover':
      return selection;
  }
};

const dimensionPolylines = (a: Vec2, b: Vec2, offset: number): Polyline[] => {
  const line = dimensionLine({ a, b, offset });
  const main = { points: [line.a, line.b], closed: false };
  if (offset === 0) return [main];
  return [main, { points: [a, line.a], closed: false }, { points: [b, line.b], closed: false }];
};

interface DimensionLines3dProps {
  a: Vec2;
  b: Vec2;
  offset?: number;
  tone?: DimensionTone;
}

/**
 * A dimension's line on its plane (y = 0 of the enclosing group), with extension lines
 * back to `a` and `b`; faintly through the pieces that hide it.
 */
export const DimensionLines3d = ({ a, b, offset = 0, tone = 'live' }: DimensionLines3dProps) => {
  const tokens = useThemeTokens();
  const lines = useMemo(() => dimensionPolylines(a, b, offset), [a, b, offset]);
  return <PlaneLines lines={lines} color={toneColor(tone, tokens)} />;
};

/** The pinned dimensions below the cut, each at its own height (labels: `PinnedDimensionLabels3d`). */
export const Dimensions3d = () => {
  const { dimensions } = useCutPlan();
  const toneOf = useDimensionTone();
  return (
    <>
      {Object.values(dimensions).map(({ id, a, b, offset, elevation }) => (
        <group key={id} position-y={elevation}>
          <DimensionLines3d a={a} b={b} offset={offset} tone={toneOf(id)} />
        </group>
      ))}
    </>
  );
};
