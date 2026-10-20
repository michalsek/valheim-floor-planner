/**
 * How solid the 3D ghosts above the cut are (the Cut bar's Ghost opacity slider; higher
 * is more solid), remembered per browser. The old level plate's frost key is left in
 * place (orphaned, harmless).
 */
import { persistedAtom } from './browserStorage';

/** The ghosts' opacity until the slider moves. */
export const DEFAULT_GHOST_OPACITY = 0.25;
/** The slider's range: past it the ghosts would hide what is behind them. */
export const MAX_GHOST_OPACITY = 0.6;

/** The ghosts' opacity, 0 to `MAX_GHOST_OPACITY` (a stored value out of range is clamped). */
export const ghostOpacityAtom = persistedAtom<number>(
  'valheimFloorPlanner.ghostOpacity.v1',
  DEFAULT_GHOST_OPACITY,
  (stored) => {
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), MAX_GHOST_OPACITY) : null;
  },
  String
);
