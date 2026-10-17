/**
 * What a roof may hold. Commands and file parsing share these checks, so whatever a
 * command accepts also loads. Pure.
 */
import { ROOF_PITCHES } from '../../catalog/roofFamilies';
import { elevationProblem } from '../elevation';
import { signedArea } from '../geometry/polyline';
import { isAxisRect, ringBox, simplifyRing } from '../geometry/rings';
import type { Roof, RoofKind, RoofOverhang, RoofSide, Vec2 } from '../types';

/** Larger roofs would make the tiler crawl (metres). */
export const MAX_ROOF_SIDE = 256;
/** The highest wall top a roof can rest on above its level (metres). */
export const MAX_ROOF_BASE = 64;

export const ROOF_KINDS: readonly RoofKind[] = ['gable', 'hip', 'shed'];
export const ROOF_OVERHANGS: readonly RoofOverhang[] = [0, 1, 2];
export const ROOF_SIDES: readonly RoofSide[] = ['-x', '+x', '-z', '+z'];
export const GABLE_WALL_OPTIONS: readonly Roof['gableWalls'][] = ['none', 'wood', 'ashwood'];

type Edge = { a: Vec2; b: Vec2 };

/** Whether two axis-aligned segments share any point. */
const touch = (e: Edge, f: Edge): boolean =>
  Math.max(Math.min(e.a.x, e.b.x), Math.min(f.a.x, f.b.x)) <=
    Math.min(Math.max(e.a.x, e.b.x), Math.max(f.a.x, f.b.x)) &&
  Math.max(Math.min(e.a.z, e.b.z), Math.min(f.a.z, f.b.z)) <=
    Math.min(Math.max(e.a.z, e.b.z), Math.max(f.a.z, f.b.z));

/**
 * Whether an orthogonal ring crosses or touches itself: edges that aren't neighbours
 * meet, or neighbours double back over each other.
 */
const selfIntersects = (ring: readonly Vec2[]): boolean => {
  const edges = ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length]! }));
  const n = edges.length;
  return edges.some((e, i) => {
    const next = edges[(i + 1) % n]!;
    const dot = (e.b.x - e.a.x) * (next.b.x - next.a.x) + (e.b.z - e.a.z) * (next.b.z - next.a.z);
    if (dot < 0) return true;
    return edges.some((f, j) => j > i + 1 && !(i === 0 && j === n - 1) && touch(e, f));
  });
};

const outlineProblem = (outline: Roof['outline']): string | null => {
  if (outline.length < 4) return 'the outline needs at least 4 corners';
  if (!outline.every((p) => Number.isInteger(p.x) && Number.isInteger(p.z))) {
    return 'the outline must be on the 1 m grid';
  }
  const orthogonal = outline.every((p, i) => {
    const q = outline[(i + 1) % outline.length]!;
    return (p.x === q.x) !== (p.z === q.z);
  });
  if (!orthogonal) return 'the outline must have only straight, axis-aligned sides';
  if (selfIntersects(outline)) return 'the outline must not cross or touch itself';
  if (signedArea(outline) <= 0) return 'the outline must run clockwise';
  const { w, d } = ringBox(outline);
  if (w > MAX_ROOF_SIDE || d > MAX_ROOF_SIDE) return `sides of at most ${MAX_ROOF_SIDE} m`;
  return null;
};

/** Why `roof` can't be stored, or null when it can. */
export const roofProblem = (roof: Roof): string | null => {
  const outline = outlineProblem(roof.outline);
  if (outline) return outline;
  if (!(roof.base > 0 && roof.base <= MAX_ROOF_BASE)) {
    return `the wall top must be above 0 and at most ${MAX_ROOF_BASE} m up`;
  }
  if (!ROOF_PITCHES.includes(roof.pitch)) return 'the pitch must be 26, 45 or 67°';
  if (!ROOF_KINDS.includes(roof.kind)) return 'the kind must be gable, hip or shed';
  if (roof.ridgeAxis !== 'x' && roof.ridgeAxis !== 'z') {
    return "the ridge must run along 'x' or 'z'";
  }
  const { eave, gable } = roof.overhang;
  if (!ROOF_OVERHANGS.includes(eave) || !ROOF_OVERHANGS.includes(gable)) {
    return 'overhangs must be 0, 1 or 2 m';
  }
  if (!ROOF_SIDES.includes(roof.lowSide)) return "the low side must be '-x', '+x', '-z' or '+z'";
  if (!GABLE_WALL_OPTIONS.includes(roof.gableWalls)) return 'unknown gable walls';
  if (roof.kind !== 'hip' && !isAxisRect(simplifyRing(roof.outline))) {
    return 'only a hip roof can cover an outline that is not a rectangle';
  }
  return elevationProblem(roof.elevation);
};
