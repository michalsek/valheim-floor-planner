/**
 * A palette tile's glyph (M17 §2.4): the piece as the planner draws it (its collider box,
 * roof shape or beam, from `rawBox`), in an isometric view from above.
 * Faces are flat-shaded by which way they face; only a face's outline is stroked, not
 * the seams between its triangles. Needs no models. Pure.
 */
import type { PieceDef } from '../../catalog/pieceDefs';
import { fromLocal } from '../../model/geometry/orient';
import { SHAPE_TRIANGLES } from '../../model/geometry/shapes';
import { rawBox } from '../../model/rawBoxes';
import type { RawShapeLib } from '../../model/rawShapes';
import type { Vec3 } from '../../model/types';

/** How a face is lit: from above, or a side facing left or right on screen. */
export type GlyphTone = 'top' | 'left' | 'right';

export interface GlyphFace {
  tone: GlyphTone;
  /** The face's triangles, as an SVG path. */
  fill: string;
  /** The face's outline (edges no other triangle of the face shares). */
  edges: string;
}

export interface PieceGlyph {
  /** The faces' bounds, fitted to 100 units on the longer side, with a margin. */
  viewBox: string;
  /** Back to front. */
  faces: GlyphFace[];
}

const unit = (x: number, y: number, z: number): Vec3 => {
  const n = Math.hypot(x, y, z);
  return { x: x / n, y: y / n, z: z / n };
};

/**
 * Towards the viewer; screen right; screen down (SVG's y). The viewer stands on the −z
 * side, which roof pieces face (they rise towards +z): from +z a 45° slope is edge-on.
 */
const VIEW = unit(1, 1, -1);
const RIGHT = unit(-1, 0, -1);
const DOWN = unit(1, -2, -1);

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const key3 = (p: Vec3) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`;

const toneOf = (n: Vec3): GlyphTone => {
  if (n.y > 0.5) return 'top';
  return dot(n, RIGHT) >= 0 ? 'right' : 'left';
};

interface Group {
  tone: GlyphTone;
  tris: Vec3[][];
  depth: number;
}

/** The front-facing triangles of the box, grouped by the plane they lie in. */
const facesOf = (corners: readonly Vec3[][]): Group[] => {
  const groups = new Map<string, Group>();
  for (const [a, b, c] of corners) {
    if (!a || !b || !c) continue;
    const raw = cross(sub(b, a), sub(c, a));
    const length = Math.hypot(raw.x, raw.y, raw.z);
    if (length < 1e-9) continue;
    const n = { x: raw.x / length, y: raw.y / length, z: raw.z / length };
    if (dot(n, VIEW) <= 1e-6) continue;
    const key = `${key3(n)}|${dot(n, a).toFixed(3)}`;
    const group = groups.get(key) ?? { tone: toneOf(n), tris: [], depth: 0 };
    group.tris.push([a, b, c]);
    group.depth += dot({ x: a.x + b.x + c.x, y: a.y + b.y + c.y, z: a.z + b.z + c.z }, VIEW);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, depth: g.depth / g.tris.length }))
    .sort((p, q) => p.depth - q.depth);
};

/** Edges used once within the group: its outline. */
const outline = (tris: readonly Vec3[][]): [Vec3, Vec3][] => {
  const edges = new Map<string, { a: Vec3; b: Vec3; count: number }>();
  for (const tri of tris) {
    tri.forEach((a, i) => {
      const b = tri[(i + 1) % tri.length]!;
      const key = [key3(a), key3(b)].sort().join('|');
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, { a, b, count: 1 });
    });
  }
  return [...edges.values()].filter((e) => e.count === 1).map((e): [Vec3, Vec3] => [e.a, e.b]);
};

/** The glyph's corners in the world: the box's triangles, sized, turned and placed. */
const boxTriangles = (def: PieceDef, lib: RawShapeLib): Vec3[][] => {
  const box = rawBox(
    {
      id: 'glyph',
      prefab: def.prefab,
      position: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0, roll: 0 },
    },
    lib
  );
  const flat = SHAPE_TRIANGLES[box.shape ?? 'box'];
  const point = (i: number): Vec3 =>
    fromLocal(
      { x: flat[i]! * box.size.x, y: flat[i + 1]! * box.size.y, z: flat[i + 2]! * box.size.z },
      box
    );
  const tris: Vec3[][] = [];
  for (let i = 0; i < flat.length; i += 9) tris.push([point(i), point(i + 3), point(i + 6)]);
  return tris;
};

const MARGIN = 0.06;

/** The piece's glyph; null when it has no extent to draw. */
export const pieceGlyph = (def: PieceDef, lib: RawShapeLib): PieceGlyph | null => {
  const groups = facesOf(boxTriangles(def, lib));
  const points = groups.flatMap((g) => g.tris.flat());
  if (points.length === 0) return null;
  const xs = points.map((p) => dot(p, RIGHT));
  const ys = points.map((p) => dot(p, DOWN));
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  const side = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY);
  if (side < 1e-6) return null;
  const scale = 100 / side;
  const at = (p: Vec3) =>
    `${((dot(p, RIGHT) - minX) * scale).toFixed(1)} ${((dot(p, DOWN) - minY) * scale).toFixed(1)}`;
  const w = (Math.max(...xs) - minX) * scale;
  const h = (Math.max(...ys) - minY) * scale;
  const m = 100 * MARGIN;
  return {
    viewBox: `${-m} ${-m} ${(w + 2 * m).toFixed(1)} ${(h + 2 * m).toFixed(1)}`,
    faces: groups.map((g) => ({
      tone: g.tone,
      fill: g.tris.map((t) => `M${t.map(at).join('L')}Z`).join(''),
      edges: outline(g.tris)
        .map(([a, b]) => `M${at(a)}L${at(b)}`)
        .join(''),
    })),
  };
};

const cache = new WeakMap<object, Map<string, PieceGlyph | null>>();

/** `pieceGlyph`, worked out once per prefab and library. */
export const cachedGlyph = (def: PieceDef, lib: RawShapeLib): PieceGlyph | null => {
  let byPrefab = cache.get(lib.catalog);
  if (!byPrefab) cache.set(lib.catalog, (byPrefab = new Map()));
  if (!byPrefab.has(def.prefab)) byPrefab.set(def.prefab, pieceGlyph(def, lib));
  return byPrefab.get(def.prefab) ?? null;
};
