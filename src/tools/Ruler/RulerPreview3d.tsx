import { useAtomValue } from 'jotai';

import { DimensionLabel3d } from '../../overlay/DimensionLabel3d';
import { Marker3d } from '../../overlay/Marker3d';
import { DimensionLines3d } from '../../scene/view3d/Dimensions3d';
import { useCursor } from '../../store/hooks';

import { measuredLine, rulerAtom } from './rulerState';

const useMeasured = () => measuredLine(useAtomValue(rulerAtom), useCursor()?.snapped);

/** The measured line on the work plane. */
export const RulerPreview3d = () => {
  const line = useMeasured();
  return line?.b ? <DimensionLines3d a={line.a} b={line.b} /> : null;
};

/** The measured length, or a dot on A while B is still on it. */
export const RulerOverlay3d = () => {
  const line = useMeasured();
  if (!line) return null;
  if (!line.b) return <Marker3d at={line.a} r={3} />;
  return <DimensionLabel3d a={line.a} b={line.b} />;
};
