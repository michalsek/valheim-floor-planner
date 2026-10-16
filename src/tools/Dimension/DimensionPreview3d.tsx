import { useAtomValue } from 'jotai';

import { DimensionLabel3d } from '../../overlay/DimensionLabel3d';
import { Marker3d } from '../../overlay/Marker3d';
import { DimensionLines3d } from '../../scene/view3d/Dimensions3d';
import { useCursor } from '../../store/hooks';

import { dimensionDraftAtom, draftLine } from './dimensionState';

const useDraftLine = () => draftLine(useAtomValue(dimensionDraftAtom), useCursor()?.snapped);

/** The dimension being drawn, on the work plane. */
export const DimensionPreview3d = () => {
  const line = useDraftLine();
  return line?.b ? <DimensionLines3d a={line.a} b={line.b} offset={line.offset} /> : null;
};

/** Its length, or a dot on A while B is still on it. */
export const DimensionOverlay3d = () => {
  const line = useDraftLine();
  if (!line) return null;
  if (!line.b) return <Marker3d at={line.a} r={3} />;
  return <DimensionLabel3d a={line.a} b={line.b} offset={line.offset} />;
};
