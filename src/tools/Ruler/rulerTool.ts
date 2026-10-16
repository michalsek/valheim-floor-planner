import { measure } from '../../model/geometry/measure';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool } from '../types';

import { RulerIcon } from './RulerIcon';
import { RulerPreview } from './RulerPreview';
import { MIN_RULER_LENGTH, RULER_IDLE, rulerAtom } from './rulerState';

/** Click A, click B: shows the distance between them until Esc or the next click. */
export const rulerTool: Tool = {
  id: 'ruler',
  label: 'Ruler',
  shortcut: 'm',
  icon: RulerIcon,
  cursor: 'crosshair',
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    const state = ctx.get(rulerAtom);
    if (state.phase !== 'placing') {
      ctx.set(rulerAtom, { phase: 'placing', a: e.snapped });
      return;
    }
    if (measure(state.a, e.snapped).length < MIN_RULER_LENGTH) return;
    ctx.set(rulerAtom, { phase: 'done', a: state.a, b: e.snapped });
  },
  onKeyDown(e, ctx) {
    if (e.key !== 'Escape' || ctx.get(rulerAtom).phase === 'idle') return false;
    ctx.set(rulerAtom, RULER_IDLE);
    return true;
  },
  onDeactivate(ctx) {
    ctx.set(rulerAtom, RULER_IDLE);
  },
  Preview: RulerPreview,
};
