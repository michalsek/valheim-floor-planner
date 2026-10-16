import { normalizeDeg } from '../../model/geometry/propGeometry';
import { newId } from '../../model/newId';
import { rotateStep } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import type { Tool } from '../types';

import { PropIcon } from './PropIcon';
import { PropOptions } from './PropOptions';
import { PropPreview, PropWorldPreview } from './PropPreview';
import { armedPrefabAtom, propGhostAtom, propRotationAtom } from './propState';

/**
 * Pick an item in the catalogue, then click to place it (the tool stays armed). R turns
 * the ghost 90°, Shift+R 22.5°; Esc disarms. At right angles the footprint's edges snap
 * to the grid, at other angles its centre; Alt places freely.
 */
export const propTool: Tool = {
  id: 'prop',
  label: 'Item',
  shortcut: 'p',
  icon: PropIcon,
  cursor: 'crosshair',
  onPointerDown(e, ctx) {
    if (e.button !== PRIMARY_BUTTON) return;
    const ghost = ctx.get(propGhostAtom);
    if (!ghost) return;
    const prop = {
      id: newId(),
      prefab: ghost.def.prefab,
      position: ghost.position,
      rotation: ghost.rotation,
      upgrades: 0,
    };
    ctx.plan.dispatch({ type: 'prop.insert', prop }, { label: `Place ${ghost.def.name}` });
  },
  onKeyDown(e, ctx) {
    const turn = rotateStep(e);
    if (turn !== null) {
      ctx.set(propRotationAtom, (r) => normalizeDeg(r + turn));
      return true;
    }
    if (e.key === 'Escape' && ctx.get(armedPrefabAtom) !== null) {
      ctx.set(armedPrefabAtom, null);
      return true;
    }
    return false;
  },
  Preview: PropPreview,
  WorldPreview: PropWorldPreview,
  Options: PropOptions,
};
