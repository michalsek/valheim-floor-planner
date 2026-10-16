/** Geometry of pinned dimensions: the measured points and the offset line drawn for them. */
import type { Dimension, Vec2 } from '../types';

import { direction, dot, EPS, sideNormal } from './polyline';

/** Unit normal to the right of a→b (the direction `offset` is measured in). */
const dimensionNormal = (a: Vec2, b: Vec2): Vec2 =>
  sideNormal(direction(a, b) ?? { x: 1, z: 0 }, 'right');

/** The signed offset that puts a→b's dimension line through `p`. */
export const offsetThrough = (a: Vec2, b: Vec2, p: Vec2): number =>
  dot({ x: p.x - a.x, z: p.z - a.z }, dimensionNormal(a, b));

/** Where the dimension line is drawn: a→b moved by its offset. */
export const dimensionLine = ({ a, b, offset }: Pick<Dimension, 'a' | 'b' | 'offset'>) => {
  const n = dimensionNormal(a, b);
  const move = (p: Vec2): Vec2 => ({ x: p.x + n.x * offset, z: p.z + n.z * offset });
  return { a: move(a), b: move(b) };
};

/** True for horizontal or vertical measurements (whose Δx/Δz would be noise). */
export const isAxisAligned = (a: Vec2, b: Vec2): boolean =>
  Math.abs(a.x - b.x) < EPS || Math.abs(a.z - b.z) < EPS;
