import { describe, expect, it } from 'vitest';

import { findContacts } from './contacts';
import { boxShape } from './shape';

const box = (x: number, z: number, sx: number, sz: number, rotationY = 0, y = 1, sy = 2) =>
  boxShape({ center: { x, y, z }, size: { x: sx, y: sy, z: sz }, rotationY });

const pairs = (shapes: ReturnType<typeof box>[]) =>
  findContacts(shapes).map(({ body, on }) => [body, on]);

describe('findContacts', () => {
  it('finds faces touching within ε, both ways, and not across a 1 m gap', () => {
    expect(pairs([box(0, 0, 2, 2), box(2.08, 0, 2, 2)])).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(pairs([box(0, 0, 2, 2), box(3, 0, 2, 2)])).toEqual([]);
    // Stacked: the top one's bottom is on the other's top.
    expect(pairs([box(0, 0, 2, 2), box(0, 0, 2, 2, 0, 3)])).toHaveLength(2);
  });

  it('tests a turned box by its edges, not its bounds', () => {
    const beam = box(0, 0, 2, 0.2, Math.PI / 4);
    // The beam's bounds span x and z ±0.78; its end at (−0.71, 0.71) is inside the first
    // box, and nowhere near the second.
    expect(pairs([box(-0.75, 0.75, 0.6, 0.6), beam])).toHaveLength(2);
    expect(pairs([box(-0.75, -0.75, 0.6, 0.6), beam])).toEqual([]);
  });

  it('needs a face in common: an edge or a corner alone is no contact', () => {
    // Side by side, the top one a course higher: they share only an edge.
    expect(pairs([box(0, 0, 2, 2), box(2, 0, 2, 2, 0, 3)])).toEqual([]);
    // Stacked with a 0.05 m overlap on the plan: too narrow a face.
    expect(pairs([box(0, 0, 2, 2), box(1.95, 0, 2, 2, 0, 3)])).toEqual([]);
  });

  it('puts the support point at the centre of a body inside the other', () => {
    const [inside] = findContacts([box(0, 0, 0.2, 0.2), box(0, 0, 4, 4)]);
    expect(inside?.point).toEqual({ x: 0, y: 1, z: 0 });
  });
});
