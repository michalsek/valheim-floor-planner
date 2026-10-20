import type { Vec3 } from '../model/types';
import { pxPerMetreAtom } from '../store/pointer';
import { projection3dAtom, viewportAtom, type SessionAccess } from '../store/session';
import { viewModeAtom } from '../store/view3d';
import { pxPerMetreAt } from '../viewport/projection3d';

/** How close (screen px) the pointer must be to an object to hit or hover it. */
export const HIT_TOL_PX = 6;

/** Screen px as world metres where the pointer is (see `pxPerMetreAtom`). */
const pxToMetres = (ctx: SessionAccess, px: number): number => px / ctx.get(pxPerMetreAtom);

/** Screen px as world metres at a 3D point (in 2D, anywhere). */
export const pxToMetresAt = (ctx: SessionAccess, px: number, p: Vec3): number => {
  const projection = ctx.get(projection3dAtom);
  if (ctx.get(viewModeAtom) !== '3d' || !projection) return px / ctx.get(viewportAtom).zoom;
  return px / pxPerMetreAt(p, projection);
};

/** `HIT_TOL_PX` in world metres where the pointer is. */
export const hitTolerance = (ctx: SessionAccess): number => pxToMetres(ctx, HIT_TOL_PX);
