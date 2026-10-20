import { clampElevation, roundElevation } from '../../model/elevation';
import { samePoint } from '../../model/geometry/polyline';
import { newId } from '../../model/newId';
import { commitCommands } from '../commitCommands';
import { pxToMetresAt } from '../hitTolerance';
import { onPlaneAt } from '../picking';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool } from '../types';

import { RulerIcon } from './RulerIcon';
import { RulerPreview } from './RulerPreview';
import { RulerOverlay3d, RulerPreview3d } from './RulerPreview3d';
import { RULER_IDLE, rulerAtom } from './rulerState';

/** A pinned measurement is drawn this far (screen px at pin time, at its middle) off the line. */
const PIN_OFFSET_PX = 20;

/**
 * Click A, click B: shows the distance between them until Esc or the next click. It lies
 * flat at the height of the surface under A; in 3D, B is taken on that plane. Enter pins
 * a finished measurement to the plan as a dimension at that height.
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
      ctx.set(rulerAtom, {
        phase: 'placing',
        a: e.snapped,
        y: roundElevation(clampElevation(e.y)),
      });
      return;
    }
    const on = onPlaneAt(ctx, e, state.y);
    if (!on || samePoint(state.a, on.snapped)) return;
    ctx.set(rulerAtom, { ...state, phase: 'done', b: on.snapped });
  },
  // 3D: B over the sky, where the ruler's plane is still under the pointer.
  onPointerMiss(e, ctx) {
    const state = ctx.get(rulerAtom);
    if (e.button !== PRIMARY_BUTTON || state.phase !== 'placing') return;
    const on = onPlaneAt(ctx, e, state.y);
    if (on && !samePoint(state.a, on.snapped)) {
      ctx.set(rulerAtom, { ...state, phase: 'done', b: on.snapped });
    }
  },
  onKeyDown(e, ctx) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const state = ctx.get(rulerAtom);
    if (e.key === 'Enter' && state.phase === 'done') {
      // Off the line (to its left), so a pin taken along a wall doesn't sit on top of it.
      const elevation = state.y;
      const mid = { x: (state.a.x + state.b.x) / 2, y: elevation, z: (state.a.z + state.b.z) / 2 };
      const offset = -Math.round(pxToMetresAt(ctx, PIN_OFFSET_PX, mid) * 100) / 100;
      const dimension = { id: newId(), a: state.a, b: state.b, offset, elevation };
      commitCommands(ctx, 'Pin measurement', [{ type: 'dimension.insert', dimension }]);
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
  Preview3d: RulerPreview3d,
  Overlay3d: RulerOverlay3d,
};
