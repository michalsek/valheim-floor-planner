/**
 * Where the roof tool puts a roof: the room (or, with Shift, the building) under the
 * pointer, or a dragged rectangle (`roofSeat` says what it rests on).
 */
import { signedArea } from '../../model/geometry/polyline';
import { regionFromRings, regionRings, union } from '../../model/geometry/region';
import { pointInRing, simplifyRing, type Ring } from '../../model/geometry/rings';
import type { Room } from '../../model/rooms';
import type { Plan, Vec2 } from '../../model/types';
import { getDerived } from '../../store/planHooks';

const clockwise = (ring: readonly Vec2[]): Ring => {
  const simple = simplifyRing(ring);
  return signedArea(simple) >= 0 ? simple : [simple[0]!, ...simple.slice(1).reverse()];
};

const roomAt = (rooms: readonly Room[], p: Vec2): Room | null =>
  rooms
    .filter((room) => pointInRing(p, room.grid))
    .reduce<Room | null>((best, r) => (!best || r.gridArea < best.gridArea ? r : best), null);

/**
 * The outline under `p` on the level `plan` shows: its room's grid ring, or with
 * `building` the outline of every room joined to it. Null off any room.
 */
export const outlineAt = (plan: Plan, p: Vec2, building: boolean): Ring | null => {
  const { rooms } = getDerived(plan);
  const room = roomAt(rooms, p);
  if (!room) return null;
  if (!building) return clockwise(room.grid);
  const region = rooms.reduce(
    (all, r) => union(all, regionFromRings([r.grid])),
    regionFromRings([room.grid])
  );
  const ring = regionRings(region).find((r) => signedArea(r) > 0 && pointInRing(p, r));
  return ring ? clockwise(ring) : clockwise(room.grid);
};

/** A rectangle from two corners, clockwise; null when it is narrower than 2 m. */
export const rectOutline = (a: Vec2, b: Vec2): Ring | null => {
  const x0 = Math.min(a.x, b.x);
  const x1 = Math.max(a.x, b.x);
  const z0 = Math.min(a.z, b.z);
  const z1 = Math.max(a.z, b.z);
  if (x1 - x0 < 2 || z1 - z0 < 2) return null;
  return [
    { x: x0, z: z0 },
    { x: x1, z: z0 },
    { x: x1, z: z1 },
    { x: x0, z: z1 },
  ];
};
