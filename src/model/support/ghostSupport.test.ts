import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { rawBox } from '../rawBoxes';
import type { RawPiece } from '../types';

import { ghostSupport } from './ghostSupport';
import { modelSupport, supportModel } from './planSupport';
import { snapJoints } from './snapJoints';

const raw = (id: string, prefab: string, x: number, y: number, z: number, yaw = 0): RawPiece => ({
  id,
  prefab,
  position: { x, y, z },
  rotation: { yaw, pitch: 0, roll: 0 },
});

const boxesOf = (pieces: readonly RawPiece[]) => pieces.map((p) => rawBox(p, testLibrary));

/** The full solve of `pieces`, and the committed index the ghost uses. */
const commit = (pieces: readonly RawPiece[]) => {
  const boxes = boxesOf(pieces);
  const model = supportModel(boxes, testLibrary.catalog.materialSupport);
  const joints = snapJoints(boxes, testLibrary);
  return { index: { model, joints }, support: modelSupport(model, joints.pairs) };
};

/** `ghosts` placed on the committed `pieces`, against the full solve with them added. */
const compare = (pieces: readonly RawPiece[], ghosts: readonly RawPiece[]) => {
  const { index, support } = commit(pieces);
  const live = ghostSupport(boxesOf(ghosts), index, support);
  const full = commit([...pieces, ...ghosts]).support;
  return ghosts.map((g, i) => ({ live: live[i]!, full: full.byKey.get(`raw:${g.id}`)! }));
};

describe('ghostSupport', () => {
  // A 2 m wood wall along z, and wood floor tiles out along x from its top.
  const wall = raw('wall', 'woodwall', 0, 1, 1, 90);
  const tile = (i: number) => raw(`t${i}`, 'wood_floor', 1 + 2 * i, 2, 1);

  it('gives each tile of a cantilever what a full solve with it added gives', () => {
    const values = [0, 1, 2, 3, 4].map((n) => {
      const placed = [wall, ...Array.from({ length: n }, (_, i) => tile(i))];
      const { live, full } = compare(placed, [tile(n)])[0]!;
      expect(live.state).toBe(full.state);
      expect(live.value).toBeCloseTo(full.value, 3);
      return live;
    });
    // Near the M11 limits (70.6, 40.9, 23.7, 13.8, then the 5th breaks): a raw tile's
    // collider sits on its snap plane, a Floor-tool tile hangs below it.
    [71.4, 41.4, 24.0, 13.9].forEach((v, i) => expect(values[i]!.value).toBeCloseTo(v, 1));
    expect(values[4]!.state).toBe('collapsing');
  });

  it('grounds a ghost on the ground', () => {
    const { live } = compare([wall], [raw('far', 'woodwall', 6, 1, 6)])[0]!;
    expect(live).toMatchObject({ state: 'grounded', value: 100, full: true });
  });

  it('lets a carried set hold itself up between two walls (the pair rule)', () => {
    // Stone walls along z, two 1 m courses each, 2 m apart; a stone tile spans their tops.
    const course = (x: number, c: number) => raw(`w${x}${c}`, 'stone_wall_2x1', x, 0.5 + c, 1, 90);
    const committed = [course(0, 0), course(0, 1), course(2, 0)];
    const set = [course(2, 1), raw('tile', 'stone_floor_2x2', 1, 2.5, 1)];
    const results = compare(committed, set);
    for (const { live, full } of results) {
      expect(live.state).toBe(full.state);
      expect(live.value).toBeCloseTo(full.value, 3);
    }
    // On one wall alone it would get less: the pair takes vertical loss only.
    const alone = compare(committed, [set[1]!])[0]!;
    expect(results[1]!.live.value).toBeGreaterThan(alone.live.value);
  });

  it('leaves the carried pieces out of the committed neighbours', () => {
    const placed = [wall, tile(0)];
    const { index, support } = commit(placed);
    // The tile carried in place: it leaves itself out, then the wall too.
    const carried = boxesOf([tile(0)]);
    const [kept] = ghostSupport(carried, index, support, new Set(['raw:t0']));
    const [left] = ghostSupport(carried, index, support, new Set(['raw:t0', 'raw:wall']));
    expect(kept!.state).toBe('supported');
    expect(left!.state).toBe('collapsing');
  });
});
