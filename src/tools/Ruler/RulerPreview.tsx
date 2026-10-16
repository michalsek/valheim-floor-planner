import { useAtomValue } from 'jotai';

import { DimensionLine } from '../../overlay/DimensionLine';
import { PointMarker } from '../../overlay/PointMarker';
import { useCursor } from '../../store/hooks';

import { measuredLine, rulerAtom } from './rulerState';

export const RulerPreview = () => {
  const line = measuredLine(useAtomValue(rulerAtom), useCursor()?.snapped);
  if (!line) return null;
  if (!line.b) return <PointMarker p={line.a} />;
  return <DimensionLine a={line.a} b={line.b} />;
};
