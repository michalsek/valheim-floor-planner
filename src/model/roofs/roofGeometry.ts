/**
 * A roof's geometry on the plan, whatever it is made of: its frame, its cells and
 * their pieces' roles, the creases, and a slope arrow per eave. Cached per roof object
 * (plan objects are immutable). Pure.
 */
import type { Roof, Vec2 } from '../types';

import { roofCells, roofCreases, type Crease, type RoofCell, type RoofCreases } from './roofCells';
import { roofFrame, type RoofFrame } from './roofFrame';

/** How far in from the eave a slope arrow starts, and where it stops (metres). */
const ARROW_FROM = 1.6;
const ARROW_TO = 0.3;

export interface RoofGeometry {
  frame: RoofFrame;
  cells: RoofCell[];
  creases: RoofCreases;
  /** One per eave edge, pointing downhill to its middle. */
  arrows: Crease[];
}

const arrowOf = ({ a, b, out }: RoofFrame['eaves'][number]): Crease => {
  const mid: Vec2 = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const back = (d: number): Vec2 => ({ x: mid.x - out.x * d, z: mid.z - out.z * d });
  return { a: back(ARROW_FROM), b: back(ARROW_TO) };
};

const cache = new WeakMap<Roof, RoofGeometry>();

export const roofGeometry = (roof: Roof): RoofGeometry => {
  const cached = cache.get(roof);
  if (cached) return cached;
  const frame = roofFrame(roof);
  const cells = roofCells(frame);
  const geometry = {
    frame,
    cells,
    creases: roofCreases(frame, cells),
    arrows: frame.eaves.map(arrowOf),
  };
  cache.set(roof, geometry);
  return geometry;
};

/** Every line the 2D view draws for a roof but its eave ring. */
export const roofCreaseLines = ({ creases }: RoofGeometry): Crease[] => [
  ...creases.ridges,
  ...creases.hips,
  ...creases.valleys,
];
