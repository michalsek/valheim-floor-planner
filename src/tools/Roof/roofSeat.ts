/** Where a roof drawn on a level rests: the level it is stored on and its wall top. */
import { sameLevel } from '../../model/elevation';
import { distanceToSegment } from '../../model/geometry/measure';
import { runSegments } from '../../model/geometry/polyline';
import type { Vec2, WallRun } from '../../model/types';

/** A wall's line passes this close to an outline edge's middle to hold it up (metres). */
const ON_EDGE = 0.05;
/** A lower wall's top this close below the level still reaches it (metres). */
const REACH = 0.05;
/** The wall top a roof gets with no walls under it (metres above the level). */
const DEFAULT_BASE = 2;

/** The roof's level, and its wall tops' height above that level (always above 0). */
export interface RoofSeat {
  elevation: number;
  base: number;
}

const tallest = (walls: readonly WallRun[]): number => Math.max(...walls.map((w) => w.height));

/**
 * Where a roof over `outline`, drawn on the level at `elevation`, rests:
 * - on the tallest wall along the outline on that level;
 * - else on the walls along it of the nearest lower level whose tops reach this level
 *   (the roof drawn at the wall tops of the storey below): stored on their level, with
 *   their height as its base;
 * - else on the level's tallest wall, or 2 m up with no walls at all.
 */
export const roofSeat = (
  walls: readonly WallRun[],
  outline: readonly Vec2[],
  elevation: number
): RoofSeat => {
  const mids = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!;
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  });
  const holdsUp = (w: WallRun) =>
    runSegments(w).some((s) => mids.some((m) => distanceToSegment(m, s.a, s.b) < ON_EDGE));
  const onLevel = walls.filter((w) => sameLevel(w.elevation, elevation));
  const under = onLevel.filter(holdsUp);
  if (under.length > 0) return { elevation, base: tallest(under) };

  const below = walls.filter(
    (w) =>
      w.elevation < elevation &&
      !sameLevel(w.elevation, elevation) &&
      w.elevation + w.height >= elevation - REACH &&
      holdsUp(w)
  );
  if (below.length > 0) {
    const level = Math.max(...below.map((w) => w.elevation));
    return { elevation: level, base: tallest(below.filter((w) => sameLevel(w.elevation, level))) };
  }
  return { elevation, base: onLevel.length > 0 ? tallest(onLevel) : DEFAULT_BASE };
};
