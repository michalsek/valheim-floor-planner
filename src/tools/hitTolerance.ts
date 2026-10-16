import { viewportAtom, type SessionAccess } from '../store/session';

/** How close (screen px) the pointer must be to an object to hit or hover it. */
export const HIT_TOL_PX = 6;

/** `HIT_TOL_PX` in world metres at the current zoom. */
export const hitTolerance = (ctx: SessionAccess): number => HIT_TOL_PX / ctx.get(viewportAtom).zoom;
