import { useAtomValue } from 'jotai';

import { CarryMarks3d } from './CarryMarks';
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

/** The Select tool's 3D overlay: the selection box, snap-move marks and the sink handle. */
export const SelectOverlay3d = () => (
  <>
    <SelectBox3d />
    <CarryMarks3d />
    <SinkHandle3d />
  </>
);
