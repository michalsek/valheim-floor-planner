import { useAtomValue } from 'jotai';

import { samePoint } from '../../model/geometry/polyline';
import { DimensionLine } from '../../overlay/DimensionLine';
import { PointMarker } from '../../overlay/PointMarker';
import { useCursor } from '../../store/hooks';

import { rulerAtom } from './rulerState';

export const RulerPreview = () => {
  const state = useAtomValue(rulerAtom);
  const cursor = useCursor();

  if (state.phase === 'done') return <DimensionLine a={state.a} b={state.b} />;
  if (state.phase === 'idle') return null;

  // While placing, B follows the cursor; until it moves off A there's nothing to label.
  const b = cursor?.snapped;
  if (!b || samePoint(state.a, b)) return <PointMarker p={state.a} />;
  return <DimensionLine a={state.a} b={b} />;
};
