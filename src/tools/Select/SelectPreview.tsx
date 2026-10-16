import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { useWorldToScreen } from '../../overlay/useWorldToScreen';
import { handleWallId } from '../../model/selection';
import { useDisplayPlan } from '../../store/planHooks';
import { hoverAtom, selectionAtom } from '../../store/selection';

import { boxMode, HANDLE_PX, selectGestureAtom } from './selectState';

/** The box being dragged: solid when it selects what it contains, dashed when it touches. */
const SelectBox = () => {
  const gesture = useAtomValue(selectGestureAtom);
  const toScreen = useWorldToScreen();
  if (gesture.phase !== 'box') return null;
  const a = toScreen(gesture.startWorld);
  const b = toScreen(gesture.currentWorld);
  const touch = boxMode(gesture.startWorld, gesture.currentWorld) === 'touch';
  return (
    <rect
      className={touch ? `${styles.selectBox} ${styles.selectBoxTouch}` : styles.selectBox}
      x={Math.min(a.x, b.x)}
      y={Math.min(a.y, b.y)}
      width={Math.abs(b.x - a.x)}
      height={Math.abs(b.y - a.y)}
    />
  );
};

/** Corner handles of the single selected wall (as drawn, so they follow a drag). */
const VertexHandles = () => {
  const wallId = handleWallId(useAtomValue(selectionAtom));
  const { walls } = useDisplayPlan();
  const run = wallId ? walls[wallId] : undefined;
  const hover = useAtomValue(hoverAtom);
  const toScreen = useWorldToScreen();
  if (!run) return null;
  return (
    <g>
      {run.points.map((p, i) => {
        const { x, y } = toScreen(p);
        const hot = hover?.kind === 'vertex' && hover.wallId === run.id && hover.index === i;
        return (
          <circle
            key={i}
            className={hot ? `${styles.handle} ${styles.handleHot}` : styles.handle}
            cx={x}
            cy={y}
            r={HANDLE_PX - 1.5}
          />
        );
      })}
    </g>
  );
};

/** The Select tool's screen-space overlay: corner handles and the selection box. */
export const SelectPreview = () => (
  <>
    <VertexHandles />
    <SelectBox />
  </>
);
