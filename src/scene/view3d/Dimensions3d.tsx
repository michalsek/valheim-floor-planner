import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { mixHex } from '../../catalog/materialColors';
import { sameLevel } from '../../model/elevation';

import { dimensionLine } from '../../model/geometry/dimension';
import type { Polyline } from '../../model/geometry/box';
import type { Vec2 } from '../../model/types';
import type { DimensionTone } from '../../overlay/DimensionLine';
import { useDimensionTone } from '../../overlay/useDimensionTone';
import { useThemeTokens } from '../../store/hooks';
import { useCutPlan } from '../../store/planHooks';
import { workPlaneAtom } from '../../store/session';
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
  /** On another level than the current one: faded, and hidden behind pieces. */
  offLevel?: boolean;
}

/** How far an off-level dimension fades towards the canvas. */
const OFF_LEVEL_MIX = 0.6;

/** A dimension's line on its plane (y = 0 here), with extension lines back to `a` and `b`. */
export const DimensionLines3d = ({
  a,
  b,
  offset = 0,
  tone = 'live',
  offLevel = false,
}: DimensionLines3dProps) => {
  const tokens = useThemeTokens();
  const lines = useMemo(() => dimensionPolylines(a, b, offset), [a, b, offset]);
  const color = toneColor(tone, tokens);
  return (
    <PlaneLines
      lines={lines}
      color={offLevel ? mixHex(color, tokens.canvas, OFF_LEVEL_MIX) : color}
      throughPieces={!offLevel}
    />
  );
};

/**
 * The pinned dimensions below the cut, each on its own plane, faded off the work plane
 * (labels: `PinnedDimensionLabels3d`).
 */
export const Dimensions3d = () => {
  const { dimensions } = useCutPlan();
  const toneOf = useDimensionTone();
  const plane = useAtomValue(workPlaneAtom);
  return (
    <>
      {Object.values(dimensions).map(({ id, a, b, offset, elevation }) => (
        <group key={id} position-y={elevation}>
          <DimensionLines3d
            a={a}
            b={b}
            offset={offset}
            tone={toneOf(id)}
            offLevel={!sameLevel(elevation, plane)}
          />
        </group>
      ))}
    </>
  );
};
