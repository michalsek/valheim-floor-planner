import { samePoint } from '../../model/geometry/polyline';
import { newId } from '../../model/newId';
import { viewportAtom } from '../../store/session';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool } from '../types';

import { RulerIcon } from './RulerIcon';
import { RulerPreview } from './RulerPreview';
import { RULER_IDLE, rulerAtom } from './rulerState';

/** A pinned measurement is drawn this far (screen px at pin time) off the measured line. */
const PIN_OFFSET_PX = 20;

/**
 * Click A, click B: shows the distance between them until Esc or the next click.
 * Enter pins a finished measurement to the plan as a dimension.
 */
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
    if (samePoint(state.a, e.snapped)) return;
    ctx.set(rulerAtom, { phase: 'done', a: state.a, b: e.snapped });
  },
  onKeyDown(e, ctx) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const state = ctx.get(rulerAtom);
    if (e.key === 'Enter' && state.phase === 'done') {
      // Off the line (to its left), so a pin taken along a wall doesn't sit on top of it.
      const offset = -Math.round((PIN_OFFSET_PX / ctx.get(viewportAtom).zoom) * 100) / 100;
      const dimension = { id: newId(), a: state.a, b: state.b, offset };
      ctx.plan.dispatch({ type: 'dimension.insert', dimension }, { label: 'Pin measurement' });
      ctx.set(rulerAtom, RULER_IDLE);
      return true;
    }
    if (e.key !== 'Escape' || state.phase === 'idle') return false;
    ctx.set(rulerAtom, RULER_IDLE);
    return true;
  },
  onDeactivate(ctx) {
    ctx.set(rulerAtom, RULER_IDLE);
  },
  Preview: RulerPreview,
};
