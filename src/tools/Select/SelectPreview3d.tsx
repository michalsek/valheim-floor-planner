import { useAtomValue } from 'jotai';

import { Marker3d } from '../../overlay/Marker3d';
import { OverlayPlaneContext } from '../../overlay/useProject3d';

import { CarryMarks3d } from './CarryMarks';
import { HANDLE_DRAWN_PX, handleClass, useHandles } from './handles';
import { SelectRect } from './SelectPreview';
import { boxMode, selectGestureAtom } from './selectState';
import { SinkHandle3d } from './SinkHandle3d';

/** The box being dragged, on screen (it selects by where items are drawn). */
const SelectBox3d = () => {
  const gesture = useAtomValue(selectGestureAtom);
  if (gesture.phase !== 'box') return null;
  const { startScreen: a, currentScreen: b } = gesture;
  return <SelectRect a={a} b={b} touch={boxMode(a, b) === 'touch'} />;
};

/** The selected wall's corner handles, at the foot of each corner (on the wall's level). */
const Handles3d = () => {
  const { run, isHot } = useHandles();
  if (!run) return null;
  return (
    <OverlayPlaneContext value={run.elevation}>
      <g>
        {run.points.map((p, i) => (
          <Marker3d key={i} at={p} r={HANDLE_DRAWN_PX} className={handleClass(isHot(i))} />
        ))}
      </g>
    </OverlayPlaneContext>
  );
};

/** The Select tool's 3D overlay: corner handles, the selection box, snap-move marks, sink handle. */
export const SelectOverlay3d = () => (
  <>
    <Handles3d />
    <SelectBox3d />
    <CarryMarks3d />
    <SinkHandle3d />
  </>
);
