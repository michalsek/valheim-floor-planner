/**
 * Sites in a world: pieces within `link` metres of each other (on the plane) belong to
 * one cluster, by union-find over a spatial hash. Pure.
 */
import type { Vec2 } from '../types';

import { cloudPiece, cloudSize, dominantYaw, type PieceCloud } from './pieceCloud';

/**
 * Pieces this close (metres, on the plane) are one site: a ward's radius, so a shed or
 * storage beside the main build imports with it.
 */
export const CLUSTER_LINK = 32;
/** Clusters smaller than this are hidden by default (a lone workbench, a campfire). */
export const DEFAULT_MIN_CLUSTER = 5;

const DEG = Math.PI / 180;

/**
 * Every group of linked pieces, largest first: indices into the cloud. The cells are
 * `link / √2` wide, so a cell's pieces are all linked; neighbouring cells are joined by
 * their first close pair, and cells already in one group aren't compared at all. A dense
 * base costs about one pass, not a pass per pair (a 32 m link over a 50 k-piece base).
 */
export const groupPieces = (cloud: PieceCloud, link = CLUSTER_LINK): number[][] => {
  const n = cloudSize(cloud);
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  const x = (i: number) => cloud.position[i * 3]!;
  const z = (i: number) => cloud.position[i * 3 + 2]!;
  const size = link / Math.SQRT2;
  const cells = new Map<string, number[]>();
  const cellOf = (cx: number, cz: number) => `${cx},${cz}`;
  for (let i = 0; i < n; i++) {
    const key = cellOf(Math.floor(x(i) / size), Math.floor(z(i) / size));
    const cell = cells.get(key);
    if (cell) {
      cell.push(i);
      parent[i] = cell[0]!;
    } else cells.set(key, [i]);
  }
  const reach = link * link;
  const linked = (a: readonly number[], b: readonly number[]): boolean =>
    a.some((i) => b.some((j) => (x(i) - x(j)) ** 2 + (z(i) - z(j)) ** 2 <= reach));
  // Each pair of cells is visited once: the touching ones first, as they join a dense
  // base on their own, then those two cells out, which can still be in reach.
  const gap = (d: number) => Math.max(0, Math.abs(d) - 1) * size;
  const offsets: [number, number][] = [];
  for (let dx = 0; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      if ((dx === 0 && dz <= 0) || gap(dx) ** 2 + gap(dz) ** 2 > reach) continue;
      offsets.push([dx, dz]);
    }
  }
  const touching = (o: [number, number]) => Math.max(Math.abs(o[0]), Math.abs(o[1])) === 1;
  const grid = [...cells].map(([key, ids]) => {
    const [cx, cz] = key.split(',').map(Number) as [number, number];
    return { cx, cz, ids };
  });
  for (const pass of [offsets.filter(touching), offsets.filter((o) => !touching(o))]) {
    for (const { cx, cz, ids } of grid) {
      for (const [dx, dz] of pass) {
        const others = cells.get(cellOf(cx + dx, cz + dz));
        if (!others) continue;
        const a = find(ids[0]!);
        const b = find(others[0]!);
        if (a !== b && linked(ids, others)) parent[a] = b;
      }
    }
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(i);
    else groups.set(root, [i]);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length);
};

export interface WorldCluster {
  /** Indices of its pieces in the cloud. */
  indices: number[];
  /** World-axis bounds of the pivots on the plane. */
  min: Vec2;
  max: Vec2;
  minY: number;
  maxY: number;
  centre: Vec2;
  /** Its grid direction: the yaw most pieces share modulo 90° (degrees). */
  yaw: number;
  /** Pieces on that grid (yaw ≡ `yaw` mod 90°). */
  aligned: number;
  /** Its pivots' extent along its own grid (metres). */
  size: Vec2;
  /** The material most of its pieces are made of. */
  material: string | null;
}

const mostCommon = <T>(values: Iterable<T>): T | null => {
  const counts = new Map<T, number>();
  let best: T | null = null;
  for (const v of values) {
    const count = (counts.get(v) ?? 0) + 1;
    counts.set(v, count);
    if (best === null || count > counts.get(best)!) best = v;
  }
  return best;
};

/** A group's bounds, grid direction and main material (`materialOf` a prefab's). */
export const describeCluster = (
  cloud: PieceCloud,
  indices: number[],
  materialOf: (prefab: string) => string | null
): WorldCluster => {
  const pieces = indices.map((i) => cloudPiece(cloud, i));
  const yaw = dominantYaw(pieces.map((p) => p.yaw));
  const cos = Math.cos(yaw * DEG);
  const sin = Math.sin(yaw * DEG);
  const span = (values: number[]) =>
    values.reduce((s, v) => ({ lo: Math.min(s.lo, v), hi: Math.max(s.hi, v) }), {
      lo: Infinity,
      hi: -Infinity,
    });
  const xs = span(pieces.map((p) => p.x));
  const zs = span(pieces.map((p) => p.z));
  const ys = span(pieces.map((p) => p.y));
  // Along the build's own axes: the game's turn by −yaw.
  const us = span(pieces.map((p) => p.x * cos - p.z * sin));
  const vs = span(pieces.map((p) => p.x * sin + p.z * cos));
  return {
    indices,
    min: { x: xs.lo, z: zs.lo },
    max: { x: xs.hi, z: zs.hi },
    minY: ys.lo,
    maxY: ys.hi,
    centre: { x: (xs.lo + xs.hi) / 2, z: (zs.lo + zs.hi) / 2 },
    yaw,
    aligned: pieces.filter((p) => Math.abs(((p.yaw - yaw) % 90) + 0) < 1e-6).length,
    size: { x: us.hi - us.lo, z: vs.hi - vs.lo },
    material: mostCommon(pieces.flatMap((p) => materialOf(p.prefab) ?? [])),
  };
};
