/**
 * The shapes a piece's box can hold, as triangles in the unit box (−0.5…0.5 on each
 * axis), before the box's size, turn and position. The single source for the 3D view's
 * geometry and for picking (`ray.ts`) and screen selection. Pure.
 *
 * Local frame: x along the piece (a roof's eave), y up, z across it (up a roof's slope:
 * the planner mirrors the game's local z, see `catalog/pieceDefs.ts`). Roof surfaces are
 * thin shells under their top surface.
 */

export type PieceShape =
  | 'box'
  /** A ridge row: two slopes meeting along x at the top. */
  | 'ridge'
  /** A hip (outer) corner: high at local (−x, +z), low on the other three corners. */
  | 'hipCorner'
  /** A valley (inner) corner: low at local (+x, −z), high on the other three corners. */
  | 'valleyCorner'
  /** A gable's right triangle wall: rising towards +x. */
  | 'triangle'
  /** The gable's column across the ridge: a triangle peaking at the box's middle. */
  | 'gablePeak';

type V = readonly [number, number, number];
type Tri = readonly [V, V, V];

const H = 0.5;

/** Shell thickness of a roof surface, as a share of its box's height. */
const SHELL_RIDGE = 0.2;
const SHELL_CORNER = 0.1;

const edgeKey = (a: V, b: V): string => [a.join(), b.join()].sort().join('|');

/** A surface given by its top triangles, closed into a solid `f` thick below it. */
const shell = (top: readonly Tri[], f: number): Tri[] => {
  const down = (v: V): V => [v[0], v[1] - f, v[2]];
  const count = new Map<string, number>();
  const edges = top.flatMap(
    ([a, b, c]) =>
      [
        [a, b],
        [b, c],
        [c, a],
      ] as const
  );
  for (const [a, b] of edges) count.set(edgeKey(a, b), (count.get(edgeKey(a, b)) ?? 0) + 1);
  const sides = edges
    .filter(([a, b]) => count.get(edgeKey(a, b)) === 1)
    .flatMap(([a, b]): Tri[] => [
      [a, down(a), down(b)],
      [a, down(b), b],
    ]);
  return [...top, ...top.map(([a, b, c]): Tri => [down(a), down(c), down(b)]), ...sides];
};

/** A vertical prism of a polygon in the xy plane, the box's full depth along z. */
const prism = (polygon: readonly [number, number][]): Tri[] => {
  const at = ([x, y]: readonly [number, number], z: number): V => [x, y, z];
  const fan = (z: number): Tri[] =>
    polygon.slice(1, -1).map((p, i) => [at(polygon[0]!, z), at(p, z), at(polygon[i + 2]!, z)]);
  const sides = polygon.flatMap((p, i): Tri[] => {
    const q = polygon[(i + 1) % polygon.length]!;
    return [
      [at(p, H), at(p, -H), at(q, -H)],
      [at(p, H), at(q, -H), at(q, H)],
    ];
  });
  return [...fan(H), ...fan(-H).map(([a, b, c]): Tri => [a, c, b]), ...sides];
};

const box = (): Tri[] =>
  prism([
    [-H, -H],
    [H, -H],
    [H, H],
    [-H, H],
  ]);

/** Triangles mirrored in z (the game's pieces in planner space), still facing out. */
const mirrorZ = (tris: readonly Tri[]): Tri[] => {
  const m = ([x, y, z]: V): V => [x, y, -z + 0];
  return tris.map(([a, b, c]): Tri => [m(a), m(c), m(b)]);
};

// Corners of a cell's top as the game's pieces have them (high at y = +H, low at −H);
// the corner shapes are then mirrored into planner space.
const corner = (x: number, z: number, high: boolean): V => [x, high ? H : -H, z];

const hipA = corner(-H, -H, true);
const hipB = corner(H, -H, false);
const hipC = corner(H, H, false);
const hipD = corner(-H, H, false);

const valleyA = corner(-H, -H, true);
const valleyB = corner(H, -H, true);
const valleyC = corner(H, H, false);
const valleyD = corner(-H, H, true);

const SHAPES: Record<PieceShape, Tri[]> = {
  box: box(),
  ridge: shell(
    [
      [corner(-H, -H, false), [-H, H, 0], [H, H, 0]],
      [corner(-H, -H, false), [H, H, 0], corner(H, -H, false)],
      [[-H, H, 0], corner(-H, H, false), corner(H, H, false)],
      [[-H, H, 0], corner(H, H, false), [H, H, 0]],
    ],
    SHELL_RIDGE
  ),
  hipCorner: mirrorZ(
    shell(
      [
        [hipA, hipC, hipB],
        [hipA, hipD, hipC],
      ],
      SHELL_CORNER
    )
  ),
  valleyCorner: mirrorZ(
    shell(
      [
        [valleyA, valleyC, valleyB],
        [valleyA, valleyD, valleyC],
      ],
      SHELL_CORNER
    )
  ),
  triangle: prism([
    [-H, -H],
    [H, -H],
    [H, H],
  ]),
  gablePeak: prism([
    [-H, -H],
    [H, -H],
    [0, 0],
  ]),
};

const mapShapes = <T>(f: (tris: readonly Tri[]) => T): Readonly<Record<PieceShape, T>> =>
  Object.fromEntries(Object.entries(SHAPES).map(([shape, tris]) => [shape, f(tris)])) as Record<
    PieceShape,
    T
  >;

/** Each shape's triangles as a flat array of positions (x, y, z per vertex). */
export const SHAPE_TRIANGLES = mapShapes((tris) => new Float32Array(tris.flat(2)));

/** Each shape's distinct corners, in the unit box. */
export const SHAPE_VERTICES = mapShapes((tris): readonly V[] => [
  ...new Map(tris.flat().map((v) => [v.join(), v])).values(),
]);
