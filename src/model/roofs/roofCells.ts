/**
 * Which piece each 2 m cell of a roof takes, from the run field at the cell's nine
 * points (corners, edge midpoints, centre), relative to its lowest, in metres of run:
 *
 * | Pattern                                          | Piece                 |
 * |--------------------------------------------------|-----------------------|
 * | two corners 0 on one side, 2 opposite, centre 1  | straight, down to 0s  |
 * | corners 0, centre 1, two opposite midpoints 1    | ridge along them      |
 * | three corners 0, one 2                           | outer (hip) corner    |
 * | three corners 2, one 0                           | inner (valley) corner |
 * | corners 0, centre 1, any other midpoints         | ridge (hip apex, approximated) |
 * | anything else                                    | straight (fallback)   |
 *
 * Also the creases the 2D view draws: ridges, hips and valleys. Pure.
 */
import type { Vec2 } from '../types';

import { CELL, cellCentre, cellInside, type RoofFrame } from './roofFrame';

export type CellRole = 'straight' | 'ridge' | 'outer' | 'inner';

export interface RoofCell {
  i: number;
  j: number;
  center: Vec2;
  role: CellRole;
  /**
   * Turn about +y (three.js sense: counter-clockwise seen from above) taking the piece's
   * local frame (x along the eave, −z down the slope: the game's +z, mirrored) onto the
   * cell.
   */
  yaw: number;
  /** Run at the cell's lowest point, and how much it rises (metres of run). */
  low: number;
  rise: number;
  /** 'apex': a hip apex, elbow or tee, which no game piece matches; 'fallback': no pattern. */
  fit: 'exact' | 'apex' | 'fallback';
  /** Straight cells: downhill on the plan. */
  down: Vec2 | null;
}

export interface Crease {
  a: Vec2;
  b: Vec2;
}

export interface RoofCreases {
  ridges: Crease[];
  hips: Crease[];
  valleys: Crease[];
}

/** Offsets −1, 0, +1 cell halves, as indices 0, 1, 2. */
const STEPS = [-1, 0, 1] as const;

type Grid = number[][];

interface Side {
  /** Outward on the plan. */
  dir: Vec2;
  /** The grid indices of its two corners and its midpoint. */
  corners: [[number, number], [number, number]];
  mid: [number, number];
}

const SIDES: readonly Side[] = [
  {
    dir: { x: -1, z: 0 },
    corners: [
      [0, 0],
      [0, 2],
    ],
    mid: [0, 1],
  },
  {
    dir: { x: 1, z: 0 },
    corners: [
      [2, 0],
      [2, 2],
    ],
    mid: [2, 1],
  },
  {
    dir: { x: 0, z: -1 },
    corners: [
      [0, 0],
      [2, 0],
    ],
    mid: [1, 0],
  },
  {
    dir: { x: 0, z: 1 },
    corners: [
      [0, 2],
      [2, 2],
    ],
    mid: [1, 2],
  },
];

const CORNERS: readonly [number, number][] = [
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 2],
];

const at = (g: Grid, [a, b]: readonly [number, number]): number => g[a]![b]!;

/** Turns of a quarter, three.js sense: local (x, z) → (x cos + z sin, −x sin + z cos). */
const turn = (v: Vec2, yaw: number): Vec2 => {
  const c = Math.round(Math.cos(yaw));
  const s = Math.round(Math.sin(yaw));
  return { x: v.x * c + v.z * s, z: -v.x * s + v.z * c };
};

/** The quarter turn taking local `from` onto world `to` (both axis-aligned or diagonal). */
export const yawFor = (from: Vec2, to: Vec2): number => {
  for (let q = 0; q < 4; q++) {
    const yaw = (q * Math.PI) / 2;
    const v = turn(from, yaw);
    if (Math.abs(v.x - to.x) < 1e-6 && Math.abs(v.z - to.z) < 1e-6) return yaw;
  }
  return 0;
};

/** The cell's run field, relative to its lowest point and rounded to half metres. */
const sample = (frame: RoofFrame, centre: Vec2): { grid: Grid; low: number } => {
  const raw = STEPS.map((a) =>
    STEPS.map((b) => frame.run({ x: centre.x + a * (CELL / 2), z: centre.z + b * (CELL / 2) }))
  );
  const low = Math.min(...raw.flat());
  return { grid: raw.map((row) => row.map((v) => Math.round((v - low) * 2) / 2)), low };
};

const cornerDir = ([a, b]: readonly [number, number]): Vec2 => ({ x: a - 1, z: b - 1 });

/** The sides whose midpoint is at the top (1) of a ridge-like cell. */
const topSides = (g: Grid): Side[] => SIDES.filter((s) => at(g, s.mid) === 1);

const classify = (g: Grid): Pick<RoofCell, 'role' | 'yaw' | 'rise' | 'fit' | 'down'> => {
  const corners = CORNERS.map((c) => at(g, c));
  const centre = g[1]![1]!;
  for (const side of SIDES) {
    const opposite = SIDES.find((o) => o.dir.x === -side.dir.x && o.dir.z === -side.dir.z)!;
    const low = side.corners.every((c) => at(g, c) === 0);
    const high = opposite.corners.every((c) => at(g, c) === 2);
    if (low && high && centre === 1) {
      return {
        role: 'straight',
        yaw: yawFor({ x: 0, z: -1 }, side.dir),
        rise: 2,
        fit: 'exact',
        down: side.dir,
      };
    }
  }
  if (corners.every((v) => v === 0) && centre === 1) {
    const tops = topSides(g);
    const alongX = tops.some((s) => s.dir.x !== 0);
    const exact =
      tops.length === 2 && tops[0]!.dir.x === -tops[1]!.dir.x && tops[0]!.dir.z === -tops[1]!.dir.z;
    return {
      role: 'ridge',
      yaw: alongX ? 0 : Math.PI / 2,
      rise: 1,
      fit: exact ? 'exact' : 'apex',
      down: null,
    };
  }
  const highs = CORNERS.filter((c) => at(g, c) === 2);
  const lows = CORNERS.filter((c) => at(g, c) === 0);
  if (lows.length === 3 && highs.length === 1) {
    return {
      role: 'outer',
      yaw: yawFor({ x: -1, z: 1 }, cornerDir(highs[0]!)),
      rise: 2,
      fit: 'exact',
      down: null,
    };
  }
  if (highs.length === 3 && lows.length === 1) {
    return {
      role: 'inner',
      yaw: yawFor({ x: 1, z: -1 }, cornerDir(lows[0]!)),
      rise: 2,
      fit: 'exact',
      down: null,
    };
  }
  // Downhill towards the lowest side.
  const mean = (s: Side) => (at(g, s.corners[0]) + at(g, s.corners[1]) + at(g, s.mid)) / 3;
  const down = SIDES.reduce((best, s) => (mean(s) < mean(best) ? s : best)).dir;
  return { role: 'straight', yaw: yawFor({ x: 0, z: -1 }, down), rise: 2, fit: 'fallback', down };
};

/** Every cell of the roof with its piece. */
export const roofCells = (frame: RoofFrame): RoofCell[] => {
  const cells: RoofCell[] = [];
  for (let j = 0; j < frame.rows; j++) {
    for (let i = 0; i < frame.cols; i++) {
      if (!cellInside(frame, i, j)) continue;
      const center = cellCentre(frame, i, j);
      const { grid, low } = sample(frame, center);
      cells.push({ i, j, center, low, ...classify(grid) });
    }
  }
  return cells;
};

const offset = (c: Vec2, d: Vec2): Vec2 => ({ x: c.x + d.x, z: c.z + d.z });

/** The creases inside one cell. */
const cellCreases = (frame: RoofFrame, cell: RoofCell, out: RoofCreases): void => {
  const { grid } = sample(frame, cell.center);
  const point = (d: Vec2) => offset(cell.center, d);
  if (cell.role === 'outer' || cell.role === 'inner') {
    const value = cell.role === 'outer' ? 2 : 0;
    const corner = CORNERS.find((c) => at(grid, c) === value)!;
    const d = cornerDir(corner);
    const line = { a: point(d), b: point({ x: -d.x, z: -d.z }) };
    (cell.role === 'outer' ? out.hips : out.valleys).push(line);
    return;
  }
  if (cell.role !== 'ridge') return;
  const tops = topSides(grid);
  for (const side of tops) out.ridges.push({ a: cell.center, b: point(side.dir) });
  if (cell.fit === 'exact') return;
  // From the apex: a hip to each corner between two low sides, a valley between two high ones.
  for (const corner of CORNERS) {
    const d = cornerDir(corner);
    const beside = SIDES.filter((s) => s.dir.x === d.x || s.dir.z === d.z);
    const up = beside.filter((s) => tops.includes(s)).length;
    if (up === 0) out.hips.push({ a: cell.center, b: point(d) });
    if (up === 2) out.valleys.push({ a: cell.center, b: point(d) });
  }
};

/**
 * Seams on the shared edge of two straight cells side by side: a ridge where they slope
 * away from it, a valley where they slope towards it.
 */
const seams = (cells: readonly RoofCell[], out: RoofCreases): void => {
  const byKey = new Map(cells.map((c) => [`${c.i},${c.j}`, c]));
  for (const cell of cells) {
    for (const [di, dj] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const next = byKey.get(`${cell.i + di},${cell.j + dj}`);
      if (!next || !cell.down || !next.down) continue;
      const along = { x: dj, z: di };
      const mid = offset(cell.center, { x: di, z: dj });
      const line = { a: offset(mid, { x: -along.x, z: -along.z }), b: offset(mid, along) };
      const away =
        cell.down.x === -di && cell.down.z === -dj && next.down.x === di && next.down.z === dj;
      const towards =
        cell.down.x === di && cell.down.z === dj && next.down.x === -di && next.down.z === -dj;
      if (away) out.ridges.push(line);
      if (towards) out.valleys.push(line);
    }
  }
};

/** The roof's ridges, hips and valleys, as segments on the plan. */
export const roofCreases = (frame: RoofFrame, cells: readonly RoofCell[]): RoofCreases => {
  const out: RoofCreases = { ridges: [], hips: [], valleys: [] };
  for (const cell of cells) cellCreases(frame, cell, out);
  seams(cells, out);
  return out;
};
