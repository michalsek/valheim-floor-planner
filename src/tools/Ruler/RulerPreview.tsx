import { useAtomValue } from 'jotai';

import { measure } from '../../model/geometry/measure';
import { DimensionLine } from '../../overlay/DimensionLine';
import { PointMarker } from '../../overlay/PointMarker';
import { useCursor } from '../../store/hooks';

import { MIN_RULER_LENGTH, rulerAtom } from './rulerState';

export const RulerPreview = () => {
  const state = useAtomValue(rulerAtom);
  const cursor = useCursor();

  if (state.phase === 'done') return <DimensionLine a={state.a} b={state.b} />;
  if (state.phase === 'idle') return null;

  // While placing, B follows the cursor; until it moves off A there's nothing to label.
  const b = cursor?.snapped;
  if (!b || measure(state.a, b).length < MIN_RULER_LENGTH) return <PointMarker p={state.a} />;
  return <DimensionLine a={state.a} b={b} />;
};
