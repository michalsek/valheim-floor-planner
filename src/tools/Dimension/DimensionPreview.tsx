import { useAtomValue } from 'jotai';

import { isAxisAligned } from '../../model/geometry/dimension';
import { DimensionLine } from '../../overlay/DimensionLine';
import { PointMarker } from '../../overlay/PointMarker';
import { useCursor } from '../../store/hooks';

import { dimensionDraftAtom, draftLine } from './dimensionState';

/** The dimension being drawn: B follows the cursor, then the offset does. */
export const DimensionPreview = () => {
  const line = draftLine(useAtomValue(dimensionDraftAtom), useCursor()?.snapped);
  if (!line) return null;
  if (!line.b) return <PointMarker p={line.a} />;
  const showDelta = !isAxisAligned(line.a, line.b);
  return <DimensionLine a={line.a} b={line.b} offset={line.offset} showDelta={showDelta} />;
};
