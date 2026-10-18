import { useAtomValue } from 'jotai';

import styles from '../../overlay/Overlay.module.css';
import { usePlan } from '../../store/planHooks';
import { selectionAtom } from '../../store/selection';
import { projection3dAtom } from '../../store/session';

import { selectGestureAtom, sinkHotAtom } from './selectState';
import { handleTop, sinkTargets } from './sinkHandle';
import { sinkHandleAt } from './sinkPointer';

const R = 11;
const ARROW = 'M0 -7V7M-3.5 -3.5L0 -7L3.5 -3.5M-3.5 3.5L0 7L3.5 3.5';

/** "−0.6 m": how deep the base is, one decimal, with a real minus. */
export const formatDepth = (depth: number): string => {
  const d = Math.round(depth * 10) / 10;
  return `${d < 0 ? '−' : ''}${Math.abs(d)} m`;
};

/**
 * The sink handle over the first sinkable selected item (a vertical arrow in a ring),
 * with the live depth while it is dragged. Hidden during other gestures.
 */
export const SinkHandle3d = () => {
  const plan = usePlan();
  const selection = useAtomValue(selectionAtom);
  const gesture = useAtomValue(selectGestureAtom);
  const hot = useAtomValue(sinkHotAtom);
  const v = useAtomValue(projection3dAtom);
  if (!v || (gesture.phase !== 'idle' && gesture.phase !== 'sinking')) return null;
  const sinking = gesture.phase === 'sinking' ? gesture : null;
  const targets = sinking ? sinking.targets : sinkTargets(plan, selection);
  const top = handleTop(targets);
  if (!top) return null;
  // While dragged, the handle rides on the items as the preview moves them.
  const lift = sinking ? sinking.depth - targets[0]!.depth : 0;
  const at = sinkHandleAt({ ...top, y: top.y + lift }, v);
  if (!at) return null;
  return (
    <g transform={`translate(${at.x} ${at.y})`}>
      <circle
        r={R}
        className={hot || sinking ? `${styles.handle} ${styles.handleHot}` : styles.handle}
      />
      <path
        d={ARROW}
        fill="none"
        stroke={hot || sinking ? 'var(--canvas)' : 'var(--selection)'}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {sinking && (
        <text
          className={styles.label}
          x={R + 6}
          y={0}
          textAnchor="start"
          paintOrder="stroke"
          style={{ textAnchor: 'start' }}
        >
          {formatDepth(sinking.depth)}
        </text>
      )}
    </g>
  );
};
