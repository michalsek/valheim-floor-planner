import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';
import type { ScreenPoint } from '../../viewport/viewportMath';

import { CarryMarks2d } from './CarryMarks';
import { boxMode, selectGestureAtom } from './selectState';

/** A select box between two screen points: solid when it contains, dashed when it touches. */
export const SelectRect = ({ a, b, touch }: { a: ScreenPoint; b: ScreenPoint; touch: boolean }) => (
  <rect
    className={touch ? `${styles.selectBox} ${styles.selectBoxTouch}` : styles.selectBox}
    x={Math.min(a.x, b.x)}
    y={Math.min(a.y, b.y)}
    width={Math.abs(b.x - a.x)}
    height={Math.abs(b.y - a.y)}
  />
);

/** The box being dragged, kept in world points so a zoom mid-drag doesn't move it. */
const SelectBox = () => {
  const gesture = useAtomValue(selectGestureAtom);
  const toScreen = useWorldToScreen();
  if (gesture.phase !== 'box') return null;
  const touch = boxMode(gesture.startScreen, gesture.currentScreen) === 'touch';
  return (
    <SelectRect a={toScreen(gesture.startWorld)} b={toScreen(gesture.currentWorld)} touch={touch} />
  );
};

/** The Select tool's screen-space overlay: the selection box and snap-move marks. */
export const SelectPreview = () => (
  <>
    <SelectBox />
    <CarryMarks2d />
  </>
);
