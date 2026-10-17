/**
 * Builds in a world: pieces within `link` metres of each other (on the plane) belong to
 * one cluster, by union-find over a spatial hash. Pure.
 */
import type { Vec2 } from '../types';

import { cloudPiece, cloudSize, dominantYaw, type PieceCloud } from './pieceCloud';

/** Pieces this close (metres, on the plane) are one build. */
export const CLUSTER_LINK = 4;
/** Clusters smaller than this are hidden by default (a lone workbench, a campfire). */
export const DEFAULT_MIN_CLUSTER = 5;

const DEG = Math.PI / 180;

/** Every group of linked pieces, largest first: indices into the cloud. */
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
  const cells = new Map<string, number[]>();
  const cellOf = (cx: number, cz: number) => `${cx},${cz}`;
  for (let i = 0; i < n; i++) {
    const key = cellOf(Math.floor(x(i) / link), Math.floor(z(i) / link));
    const cell = cells.get(key);
    if (cell) cell.push(i);
    else cells.set(key, [i]);
  }
  const reach = link * link;
  for (const [key, ids] of cells) {
    const [cx, cz] = key.split(',').map(Number) as [number, number];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const others = cells.get(cellOf(cx + dx, cz + dz));
        if (!others) continue;
        for (const i of ids) {
          for (const j of others) {
            if (j <= i) continue;
            if ((x(i) - x(j)) ** 2 + (z(i) - z(j)) ** 2 <= reach) parent[find(i)] = find(j);
          }
        }
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
