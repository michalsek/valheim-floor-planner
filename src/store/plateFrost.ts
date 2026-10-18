/**
 * How opaque the 3D level plate's frosted fill is (the Levels bar's slider), remembered
 * per browser.
 */
import { persistedAtom } from './browserStorage';

/** The plate's fill opacity until the slider moves. */
export const DEFAULT_PLATE_FROST = 0.2;
/** The slider's range. */
export const MAX_PLATE_FROST = 0.6;

/** The plate fill's opacity, 0 to `MAX_PLATE_FROST` (a stored value out of range is clamped). */
export const plateFrostAtom = persistedAtom<number>(
  'valheimFloorPlanner.plateFrost.v1',
  DEFAULT_PLATE_FROST,
  (stored) => {
    const value = Number(stored);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), MAX_PLATE_FROST) : null;
  },
  String
);
