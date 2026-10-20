import { useAtomValue } from 'jotai';

import { DimensionLabel3d } from '../../overlay/DimensionLabel3d';
import { Marker3d } from '../../overlay/Marker3d';
import { OverlayPlaneContext } from '../../overlay/useProject3d';
import { DimensionLines3d } from '../../scene/view3d/Dimensions3d';
import { useCursorOnPlane } from '../../store/pointer';

import { dimensionDraftAtom, draftLine } from './dimensionState';

/** The draft line, with B on the pointer where it meets the draft's plane. */
const useDraft = () => {
  const draft = useAtomValue(dimensionDraftAtom);
  const y = draft.phase === 'idle' ? null : draft.y;
  return { line: draftLine(draft, useCursorOnPlane(y)?.snapped), y: y ?? 0 };
};

/** The dimension being drawn, at its height. */
export const DimensionPreview3d = () => {
  const { line, y } = useDraft();
  if (!line?.b) return null;
  return (
    <group position-y={y}>
      <DimensionLines3d a={line.a} b={line.b} offset={line.offset} />
    </group>
  );
};

/** Its length, or a dot on A while B is still on it. */
export const DimensionOverlay3d = () => {
  const { line, y } = useDraft();
  if (!line) return null;
  return (
    <OverlayPlaneContext value={y}>
      {line.b ? (
        <DimensionLabel3d a={line.a} b={line.b} offset={line.offset} />
      ) : (
        <Marker3d at={line.a} r={3} />
      )}
    </OverlayPlaneContext>
  );
};
