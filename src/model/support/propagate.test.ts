import { describe, expect, it } from 'vitest';

import type { MaterialSupport } from '../../catalog/pieceDefs';
import { testLibrary } from '../../catalog/testLibrary';
import { derivePlan } from '../derivePlan';
import { pieceBoxes } from '../pieceBoxes';
import { roofContacts } from '../roofs/roofContacts';
import { emptyPlan, type Plan } from '../types';

import { findContacts } from './contacts';
import { planSupport } from './planSupport';
import { GROUND_REACH, propagateSupport, type SupportBody } from './propagate';
import { boxShape } from './shape';

const MATERIALS: Record<string, MaterialSupport> = {
  wood: { maxSupport: 100, minSupport: 10, verticalLoss: 0.125, horizontalLoss: 0.2 },
  hardwood: { maxSupport: 140, minSupport: 10, verticalLoss: 0.1, horizontalLoss: 0.16667 },
  stone: { maxSupport: 1000, minSupport: 100, verticalLoss: 0.125, horizontalLoss: 1 },
};

interface TestBox {
  material: string;
  /** Min and max corners. */
  min: [number, number, number];
  max: [number, number, number];
  gives?: boolean;
}

const solve = (boxes: readonly TestBox[]) => {
  const shaped = boxes.map(({ min, max }) => ({
    center: { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, z: (min[2] + max[2]) / 2 },
    size: { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] },
    rotationY: 0,
  }));
  const bodies = boxes.map((box, i): SupportBody => ({
    com: shaped[i]!.center,
    bottom: box.min[1],
    material: MATERIALS[box.material]!,
    gives: box.gives ?? true,
  }));
  return propagateSupport(bodies, findContacts(shaped.map(boxShape)));
};

/** `n` boxes stacked from the ground, each `h` tall. */
const column = (material: string, n: number, h: number, half: number): TestBox[] =>
  Array.from({ length: n }, (_, i) => ({
    material,
    min: [-half, i * h, -0.15],
    max: [half, (i + 1) * h, 0.15],
  }));

/** A 2 m wood wall on the ground at x = 0, and `n` wood floor tiles out from its top. */
const cantilever = (n: number): TestBox[] => [
  { material: 'wood', min: [-0.15, 0, 0], max: [0.15, 2, 2] },
  ...Array.from({ length: n }, (_, i): TestBox => ({
    material: 'wood',
    min: [2 * i, 1.87, 0],
    max: [2 * i + 2, 2, 2],
  })),
];

describe('propagateSupport', () => {
  it('holds 8 wood walls (16 m) up and breaks the 9th', () => {
    const { state, value } = solve(column('wood', 9, 2, 1));
    expect(state.slice(0, 8).every((s) => s !== 'collapsing')).toBe(true);
    expect(state[8]).toBe('collapsing');
    expect(value[7]).toBeCloseTo(100 * 0.7375 ** 7, 1);
  });

  it('holds 12 log poles (24 m) up and breaks the 13th', () => {
    const { state } = solve(column('hardwood', 13, 2, 0.2));
    expect(state.slice(0, 12).every((s) => s !== 'collapsing')).toBe(true);
    expect(state[12]).toBe('collapsing');
  });

  it('fades a wood floor cantilever off a wall top and breaks the 5th tile', () => {
    const { state, value } = solve(cantilever(5));
    const tiles = [...value.slice(1)];
    [70.6, 40.9, 23.7, 13.8].forEach((expected, i) => {
      expect(Math.abs(tiles[i]! - expected)).toBeLessThan(0.5);
    });
    expect(state.slice(1, 5).every((s) => s === 'supported')).toBe(true);
    expect(state[5]).toBe('collapsing');
  });

  it('gives a stone floor beside a stone wall nothing (horizontal loss 1)', () => {
    const { state, value } = solve([
      { material: 'stone', min: [-0.5, 0, 0], max: [0.5, 2, 2] },
      { material: 'stone', min: [0.5, 1, 0], max: [2.5, 2, 2] },
    ]);
    expect(value[1]).toBe(0);
    expect(state[1]).toBe('collapsing');
  });

  it('holds a stone floor up between two walls better than on one', () => {
    const wall = (x: number): TestBox => ({
      material: 'stone',
      min: [x - 0.5, 0, 0],
      max: [x + 0.5, 2, 2],
    });
    const tile: TestBox = { material: 'stone', min: [0, 2, 0], max: [2, 3, 2] };
    const both = solve([wall(0), wall(2), tile]).value[2]!;
    const one = solve([wall(0), tile]).value[1]!;
    // The pair takes vertical loss only: 1000 · (1 − 0.125 · (|(1, 1.5)| + 0.1)).
    expect(both).toBeCloseTo(1000 * (1 - 0.125 * (Math.hypot(1, 1.5) + 0.1)), 0);
    expect(one).toBeLessThan(both);
  });

  it('caps wood on stone at the wood maximum', () => {
    const { value } = solve([
      { material: 'stone', min: [-1, 0, -0.5], max: [1, 2, 0.5] },
      { material: 'wood', min: [-1, 2, -0.15], max: [1, 4, 0.15] },
    ]);
    expect(value[1]).toBe(100);
  });

  it('leaves a loop floating in the air at 0', () => {
    const { value, state } = solve([
      { material: 'wood', min: [0, 10, 0], max: [2, 12, 0.3] },
      { material: 'wood', min: [2, 10, 0], max: [4, 12, 0.3] },
    ]);
    expect([...value]).toEqual([0, 0]);
    expect(state).toEqual(['collapsing', 'collapsing']);
  });

  it('lets a broken body hold nothing up', () => {
    const { value } = solve(column('wood', 10, 2, 1));
    expect(value[8]).toBeGreaterThan(0);
    expect(value[9]).toBe(0);
  });
});

describe('ground contact', () => {
  /** Ground rising 0.5 m per metre along x; a body's ground is the max under its footprint. */
  const slope = (p: { x: number }) => 0.5 * p.x;
  const onSlope = (bottom: number, extra: Partial<SupportBody> = {}): SupportBody => {
    const shape = boxShape({
      center: { x: 2, y: bottom + 1, z: 0 },
      size: { x: 2, y: 2, z: 0.3 },
      rotationY: Math.PI / 8,
    });
    return {
      com: shape.com,
      bottom,
      ground: Math.max(...shape.footprint.map(slope)),
      material: MATERIALS.wood!,
      gives: true,
      ...extra,
    };
  };
  const stateOf = (body: SupportBody) => propagateSupport([body], []).state[0];

  it('grounds a box resting within reach of sloped ground, and not one 0.5 m above', () => {
    const ground = onSlope(0).ground!;
    expect(ground).toBeGreaterThan(1.4);
    expect(stateOf(onSlope(ground + 0.1))).toBe('grounded');
    expect(stateOf(onSlope(ground + GROUND_REACH + 0.01))).toBe('collapsing');
    expect(stateOf(onSlope(ground + 0.5))).toBe('collapsing');
    // Buried: its bottom far into the hill.
    expect(stateOf(onSlope(ground - 3))).toBe('grounded');
  });
});

describe('poles', () => {
  /** A pole `size` across and `height` tall from `bottom`, its axis at x. */
  const pole = (material: string, x: number, height: number, bottom = 0): TestBox => ({
    material,
    min: [x - 0.2, bottom, -0.2],
    max: [x + 0.2, bottom + height, 0.2],
  });

  it('holds a 4 m log wall between log poles, the poles carrying its middle courses', () => {
    const courses = Array.from({ length: 8 }, (_, i): TestBox => ({
      material: 'hardwood',
      min: [0, 0.5 * i, -0.25],
      max: [2, 0.5 * i + 0.5, 0.25],
    }));
    const { value, state } = solve([pole('hardwood', 0, 4), pole('hardwood', 2, 4), ...courses]);
    const walls = [...value.slice(2)];
    expect(state.slice(2).every((s) => s !== 'collapsing')).toBe(true);
    // Above half the maximum all the way up: green on the game's scale.
    expect(Math.min(...walls)).toBeGreaterThan(70);
    // Level with a pole's middle a course takes its sideways support, 1 m from its axis,
    // over what the course below passes up.
    const sideways = 140 * (1 - 0.16667 * (Math.hypot(1, 0.25) + 0.1));
    expect(walls[4]).toBeCloseTo(sideways, 0);
    expect(walls[4]).toBeGreaterThan(walls[3]! * (1 - 0.1 * 0.6));
  });

  it('holds 2 m wood walls between stacked wood poles', () => {
    const { value, state } = solve([
      pole('wood', 0, 2),
      pole('wood', 0, 2, 2),
      pole('wood', 2, 2),
      pole('wood', 2, 2, 2),
      { material: 'wood', min: [0, 0, -0.15], max: [2, 2, 0.15] },
      { material: 'wood', min: [0, 2, -0.15], max: [2, 4, 0.15] },
    ]);
    expect(state.every((s) => s !== 'collapsing')).toBe(true);
    expect(Math.min(...value)).toBeGreaterThan(50);
  });

  it('holds a 4 m log beam laid with its end on a 2 m log pole top', () => {
    const { value, state } = solve([
      pole('hardwood', 0, 2),
      { material: 'hardwood', min: [0, 2, -0.25], max: [4, 2.5, 0.25] },
    ]);
    expect(state[1]).toBe('supported');
    expect(value[1]).toBeGreaterThan(70);
  });
});

describe('planSupport', () => {
  it('drops a stone floor laid beside a stone wall top, edge-touching its lower course', () => {
    const plan: Plan = {
      ...emptyPlan(),
      walls: {
        w: {
          id: 'w',
          familyId: 'stone',
          points: [
            { x: 10, z: 10 },
            { x: 10, z: 12 },
          ],
          closed: false,
          side: 'right',
          height: 2,
          elevation: 0,
        },
      },
      floors: {
        f: {
          id: 'f',
          familyId: 'stone',
          min: { x: 10, z: 10 },
          max: { x: 12, z: 12 },
          elevation: 2,
        },
      },
    };
    const boxes = pieceBoxes(derivePlan(plan, testLibrary), plan, testLibrary);
    const { byKey, collapsing } = planSupport(boxes, testLibrary.catalog.materialSupport);
    const tile = boxes.find((b) => b.kind === 'floor')!;
    expect(byKey.get(tile.key)).toMatchObject({ state: 'collapsing', value: 0 });
    expect(collapsing).toEqual([{ item: { kind: 'floor', id: 'f' }, count: 1 }]);
  });

  /** A wood house `w` × `d` on 2 m walls with a thatch 26° gable, 1 m eaves and gables. */
  const roofedHouse = (w: number, d: number, roof: Partial<Plan['roofs'][string]> = {}) => {
    const outline = [
      { x: 0, z: 0 },
      { x: w, z: 0 },
      { x: w, z: d },
      { x: 0, z: d },
    ];
    const plan: Plan = {
      ...emptyPlan(),
      walls: {
        w: {
          id: 'w',
          familyId: 'wood',
          points: outline,
          closed: true,
          side: 'right',
          height: 2,
          elevation: 0,
        },
      },
      roofs: {
        r: {
          id: 'r',
          elevation: 0,
          base: 2,
          outline,
          familyId: 'thatch',
          pitch: 26,
          kind: 'gable',
          ridgeAxis: 'x',
          lowSide: '-z',
          overhang: { eave: 1, gable: 1 },
          gableWalls: 'none',
          ...roof,
        },
      },
    };
    const derived = derivePlan(plan, testLibrary);
    return planSupport(
      pieceBoxes(derived, plan, testLibrary),
      testLibrary.catalog.materialSupport,
      roofContacts(plan, derived, testLibrary)
    );
  };

  it('fades a wood 26° roof row by row off its walls and breaks it about 10 m in', () => {
    const { byKey } = roofedHouse(8, 26);
    // Rows across the 26 m span (28 m of eave ring, 14 rows) in the middle column.
    const row = (j: number) => byKey.get(`r:2:${j}`)!;
    [81, 52, 33, 21, 14].forEach((value, j) => {
      expect(row(j).value).toBeCloseTo(value, -0.5);
      expect(row(j).state).toBe('supported');
    });
    // Row 5's middle is 11 m from the eave, 10 m in from the wall.
    expect(row(5).state).toBe('collapsing');
  });

  it('holds a 7 × 8 house up: the filler course carries the far eave', () => {
    const { collapsing } = roofedHouse(7, 8, { ridgeAxis: 'z', gableWalls: 'wood' });
    expect(collapsing).toEqual([]);
  });
});
