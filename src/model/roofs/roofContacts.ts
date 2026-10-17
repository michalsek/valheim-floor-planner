/**
 * Contacts the support check can't be left to find from shapes alone: a roof's eave
 * cells rest on the walls (and filler courses) under them where the roof plane crosses
 * their top edge. At 67° an overlap test on a slab that only meets an edge is fragile,
 * so these pairs are declared. Cells resting on each other share faces, which the
 * overlap test finds. Cached per roof while its level's walls stay. Pure.
 */
import type { Library } from '../../catalog/library';
import { sameLevel } from '../elevation';
import type { Derived } from '../derivePlan';
import { ringBox } from '../geometry/rings';
import { levelPlan } from '../levels';
import type { PlacedPiece, Plan, Roof, Vec2 } from '../types';

import { CELL } from './roofFrame';
import { roofGeometry } from './roofGeometry';
import type { RoofPiece } from './roofPiece';
import { eaveHeight, type RoofLib } from './tileRoof';

/** How far the roof may pass above or below a wall's top and still rest on it (metres). */
const REST_TOLERANCE = 0.05;

type Pair = readonly [string, string];

/** The part of a segment inside an axis-aligned square (Liang–Barsky); null when none. */
const clipToSquare = (a: Vec2, b: Vec2, centre: Vec2, half: number): [Vec2, Vec2] | null => {
  let t0 = 0;
  let t1 = 1;
  const d = { x: b.x - a.x, z: b.z - a.z };
  for (const axis of ['x', 'z'] as const) {
    const lo = centre[axis] - half - a[axis];
    const hi = centre[axis] + half - a[axis];
    if (Math.abs(d[axis]) < 1e-12) {
      if (lo > 0 || hi < 0) return null;
      continue;
    }
    const u = lo / d[axis];
    const v = hi / d[axis];
    t0 = Math.max(t0, Math.min(u, v));
    t1 = Math.min(t1, Math.max(u, v));
  }
  if (t1 - t0 < 1e-6) return null;
  const at = (t: number) => ({ x: a.x + d.x * t, z: a.z + d.z * t });
  return [at(t0), at(t1)];
};

/** A wall piece's centre line on the plan. */
const centreLine = (piece: PlacedPiece): [Vec2, Vec2] => {
  const half = piece.footprint.length / 2;
  const dir = { x: Math.cos(piece.rotation), z: Math.sin(piece.rotation) };
  return [
    { x: piece.center.x - dir.x * half, z: piece.center.z - dir.z * half },
    { x: piece.center.x + dir.x * half, z: piece.center.z + dir.z * half },
  ];
};

/** A wall piece (or filler) top line a roof cell may rest on. */
interface Support {
  key: string;
  line: [Vec2, Vec2];
  top: number;
}

/** A filler piece's centre line and top, as a support. */
const fillerSupport = (piece: RoofPiece): Support => {
  const half = piece.size.x / 2;
  const dir = { x: Math.cos(piece.yaw), z: -Math.sin(piece.yaw) };
  return {
    key: piece.key,
    line: [
      { x: piece.center.x - dir.x * half, z: piece.center.z - dir.z * half },
      { x: piece.center.x + dir.x * half, z: piece.center.z + dir.z * half },
    ],
    top: piece.center.y + piece.size.y / 2,
  };
};

/** Cells whose roof plane crosses the top of a support under them. */
const restingPairs = (
  roof: Roof,
  pieces: readonly RoofPiece[],
  supports: readonly Support[],
  lib: RoofLib
): Pair[] => {
  const k = lib.roofFamilies.get(roof.familyId)?.pitches.get(roof.pitch)?.k;
  if (k === undefined) return [];
  const { frame } = roofGeometry(roof);
  const eaveY = eaveHeight(roof, k);
  return pieces.flatMap((piece) => {
    if (!piece.cell) return [];
    const centre = { x: piece.center.x, z: piece.center.z };
    return supports.flatMap((support): Pair[] => {
      const [a, b] = support.line;
      const part = clipToSquare(a, b, centre, CELL / 2);
      if (!part) return [];
      const ys = part.map((p) => eaveY + k * frame.run(p));
      const { top } = support;
      const rests =
        Math.min(...ys) - REST_TOLERANCE <= top && top <= Math.max(...ys) + REST_TOLERANCE;
      return rests ? [[piece.key, support.key]] : [];
    });
  });
};

interface Entry {
  walls: Plan['walls'];
  lib: Library;
  pairs: Pair[];
}

const cache = new WeakMap<Roof, Entry>();

/** The wall pieces whose top is the roof's wall top, near the roof on the plan. */
const wallSupports = (
  roof: Roof,
  walls: Plan['walls'],
  wallPieces: ReadonlyMap<string, readonly PlacedPiece[]>
): Support[] => {
  const top = roof.elevation + roof.base;
  const { min, max } = ringBox(roofGeometry(roof).frame.ring);
  return Object.values(walls).flatMap((run) =>
    (wallPieces.get(run.id) ?? []).flatMap((piece): Support[] => {
      const { x, z } = piece.center;
      const reach = piece.footprint.length / 2;
      const nearby =
        x + reach >= min.x && x - reach <= max.x && z + reach >= min.z && z - reach <= max.z;
      if (!nearby || !sameLevel(run.elevation + piece.base + piece.height, top)) return [];
      return [{ key: piece.key, line: centreLine(piece), top }];
    })
  );
};

/** Every declared roof contact of the plan, by box key (`planSupport`'s `extra`). */
export const roofContacts = (
  plan: Plan,
  derived: Pick<Derived, 'pieces' | 'roofPieces'>,
  lib: Library
): Pair[] => {
  let wallPieces: Map<string, PlacedPiece[]> | null = null;
  return Object.values(plan.roofs).flatMap((roof) => {
    const walls = levelPlan(plan, roof.elevation, lib).walls;
    const cached = cache.get(roof);
    if (cached && cached.walls === walls && cached.lib === lib) return cached.pairs;
    if (!wallPieces) {
      wallPieces = new Map();
      for (const p of derived.pieces) {
        if (p.kind !== 'wall') continue;
        const list = wallPieces.get(p.sourceId);
        if (list) list.push(p);
        else wallPieces.set(p.sourceId, [p]);
      }
    }
    const pieces = derived.roofPieces.filter((p) => p.sourceId === roof.id);
    const fillers = pieces.filter((p) => p.role === 'filler').map(fillerSupport);
    const supports = [...wallSupports(roof, walls, wallPieces), ...fillers];
    const pairs = restingPairs(roof, pieces, supports, lib);
    cache.set(roof, { walls, lib, pairs });
    return pairs;
  });
};
