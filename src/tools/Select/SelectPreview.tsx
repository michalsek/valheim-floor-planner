import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';
import type { ScreenPoint } from '../../viewport/viewportMath';

import { CarryMarks2d } from './CarryMarks';
import { HANDLE_DRAWN_PX, handleClass, useHandles } from './handles';
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

/** Corner handles of the single selected wall. */
const VertexHandles = () => {
  const { run, isHot } = useHandles();
  const toScreen = useWorldToScreen();
  if (!run) return null;
  return (
    <g>
      {run.points.map((p, i) => {
        const { x, y } = toScreen(p);
        return (
          <circle key={i} className={handleClass(isHot(i))} cx={x} cy={y} r={HANDLE_DRAWN_PX} />
        );
      })}
    </g>
  );
};

/** The Select tool's screen-space overlay: corner handles, the selection box, snap-move marks. */
export const SelectPreview = () => (
  <>
    <VertexHandles />
    <SelectBox />
    <CarryMarks2d />
  </>
);
