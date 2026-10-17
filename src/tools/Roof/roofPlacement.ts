/**
 * Where the roof tool puts a roof: the room (or, with Shift, the building) under the
 * pointer, or a dragged rectangle; and the wall tops it rests on.
 */
import { sameLevel } from '../../model/elevation';
import { distanceToSegment } from '../../model/geometry/measure';
import { runSegments, signedArea } from '../../model/geometry/polyline';
import { regionFromRings, regionRings, union } from '../../model/geometry/region';
import { pointInRing, simplifyRing, type Ring } from '../../model/geometry/rings';
import type { Room } from '../../model/rooms';
import type { Plan, Vec2 } from '../../model/types';
import { getDerived } from '../../store/planHooks';

/** A wall's line passes this close to an outline edge's middle to hold it up (metres). */
const ON_EDGE = 0.05;
/** The wall top a roof gets with no walls under it (metres above the level). */
const DEFAULT_BASE = 2;

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

/**
 * The height of the tallest wall top along the outline above the level (the walls the
 * roof rests on); any wall's on the level without such walls, else 2 m.
 */
export const wallTopUnder = (plan: Plan, outline: readonly Vec2[], elevation: number): number => {
  const walls = Object.values(plan.walls).filter((w) => sameLevel(w.elevation, elevation));
  const mids = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  });
  const under = walls.filter((w) =>
    runSegments(w).some((s) => mids.some((m) => distanceToSegment(m, s.a, s.b) < ON_EDGE))
  );
  const heights = (under.length > 0 ? under : walls).map((w) => w.height);
  return heights.length > 0 ? Math.max(...heights) : DEFAULT_BASE;
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
