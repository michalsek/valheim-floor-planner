import { normalizeDeg } from '../../model/geometry/propGeometry';
import { newId } from '../../model/newId';
import { rotateStep } from '../keys';
import { PRIMARY_BUTTON } from '../pointerButtons';
import { commitCommands } from '../commitCommands';
import type { Tool } from '../types';

import { flightRise, ghostSteps } from './propFlight';
import { PropIcon } from './PropIcon';
import { PropOptions } from './PropOptions';
import { PropPreview, PropWorldPreview } from './PropPreview';
import { PropPreview3d } from './PropPreview3d';
import { armedPrefabAtom, propGhostAtom, propRotationAtom } from './propState';

/**
 * Pick an item in the catalogue, then click to place it (the tool stays armed). R turns
 * the ghost 90°, Shift+R 22.5°; Esc disarms. At right angles the footprint's edges snap
 * to the grid, at other angles its centre; Alt places freely. Stairs and ladders place
 * a whole flight up to the rise in the options, as one undo entry.
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
    const steps = ghostSteps(ghost, ghost.elevation, flightRise(ctx, ghost.elevation));
    const label = ghost.def.flight ? 'Add stairs' : `Place ${ghost.def.name}`;
    const cmds = steps.map((step) => ({
      type: 'prop.insert' as const,
      prop: { id: newId(), prefab: ghost.def.prefab, upgrades: 0, ...step },
    }));
    // One entry; the cut rises to show what was placed.
    commitCommands(ctx, label, cmds);
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
  Preview3d: PropPreview3d,
  Options: PropOptions,
};
