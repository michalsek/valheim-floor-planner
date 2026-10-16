import { useAtomValue } from 'jotai';

import { isAxisAligned, offsetThrough } from '../../model/geometry/dimension';
import { samePoint } from '../../model/geometry/polyline';
import { DimensionLine } from '../../overlay/DimensionLine';
import { PointMarker } from '../../overlay/PointMarker';
import { useCursor } from '../../store/hooks';

import { dimensionDraftAtom } from './dimensionState';

/** The dimension being drawn: B follows the cursor, then the offset does. */
export const DimensionPreview = () => {
  const draft = useAtomValue(dimensionDraftAtom);
  const p = useCursor()?.snapped;

  if (draft.phase === 'idle') return null;
  if (draft.phase === 'b') {
    if (!p || samePoint(draft.a, p)) return <PointMarker p={draft.a} />;
    return <DimensionLine a={draft.a} b={p} showDelta={!isAxisAligned(draft.a, p)} />;
  }
  const offset = p ? offsetThrough(draft.a, draft.b, p) : 0;
  const showDelta = !isAxisAligned(draft.a, draft.b);
  return <DimensionLine a={draft.a} b={draft.b} offset={offset} showDelta={showDelta} />;
};
