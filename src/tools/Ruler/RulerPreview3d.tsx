import { useAtomValue } from 'jotai';

import { DimensionLabel3d } from '../../overlay/DimensionLabel3d';
import { Marker3d } from '../../overlay/Marker3d';
import { OverlayPlaneContext } from '../../overlay/useProject3d';
import { DimensionLines3d } from '../../scene/view3d/Dimensions3d';
import { useCursorOnPlane } from '../../store/pointer';

import { measuredLine, rulerAtom } from './rulerState';

/** The measured line, with B on the pointer where it meets the ruler's plane. */
const useMeasured = () => {
  const state = useAtomValue(rulerAtom);
  const y = state.phase === 'idle' ? null : state.y;
  return { line: measuredLine(state, useCursorOnPlane(y)?.snapped), y: y ?? 0 };
};

/** The measured line, at its height. */
export const RulerPreview3d = () => {
  const { line, y } = useMeasured();
  if (!line?.b) return null;
  return (
    <group position-y={y}>
      <DimensionLines3d a={line.a} b={line.b} />
    </group>
  );
};

/** The measured length, or a dot on A while B is still on it. */
export const RulerOverlay3d = () => {
  const { line, y } = useMeasured();
  if (!line) return null;
  return (
    <OverlayPlaneContext value={y}>
      {line.b ? <DimensionLabel3d a={line.a} b={line.b} /> : <Marker3d at={line.a} r={3} />}
    </OverlayPlaneContext>
  );
};
