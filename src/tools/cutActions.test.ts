import { createStore } from 'jotai';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';
import { emptyPlan, type Plan, type RawPiece } from '../model/types';
import { startNewPlan } from '../store/fileActions';
import { setLibrary } from '../store/libraryInstance';
import { createPlanStore } from '../store/planStore';
import { selectionAtom } from '../store/selection';
import { cutHeightAtom, lastCutAtom, resetCut } from '../store/session';

import { commitCommands } from './commitCommands';
import { jumpStop, setCut, toggleAll } from './cutActions';
import { deleteSelection } from './Select/selectActions';
import type { ToolContext } from './types';

const raw = (id: string, prefab: string, y: number, x = 0): RawPiece => ({
  id,
  prefab,
  position: { x, y, z: 0 },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
});

const planOf = (...pieces: RawPiece[]): Plan => ({
  ...emptyPlan(),
  rawPieces: Object.fromEntries(pieces.map((p) => [p.id, p])),
});

/** Two stone floors 1 m thick: stops at about 0.5 and 4.5. */
const storeys = planOf(
  raw('a', 'stone_floor_2x2', 1),
  raw('b', 'stone_floor_2x2', 1, 2),
  raw('c', 'stone_floor_2x2', 5),
  raw('d', 'stone_floor_2x2', 5, 2)
);

const contextOf = (plan: Plan = emptyPlan()): ToolContext => ({
  ...createStore(),
  plan: createPlanStore(plan),
});

beforeAll(() => setLibrary(testLibrary));

describe('cut actions', () => {
  it('raise the cut to show what was placed above it; undo leaves it', () => {
    const ctx = contextOf();
    setCut(ctx, 2);
    // A 2 m wall on the 2 m plane: its bottom is at the cut, so it would hide.
    commitCommands(ctx, 'Place', [{ type: 'raw.insert', piece: raw('a', 'woodwall', 3) }]);
    expect(ctx.get(cutHeightAtom)).toBe(3);
    commitCommands(ctx, 'Place', [{ type: 'raw.insert', piece: raw('b', 'woodwall', 1) }]);
    expect(ctx.get(cutHeightAtom)).toBe(3);
    ctx.plan.undo();
    ctx.plan.undo();
    expect(ctx.get(cutHeightAtom)).toBe(3);
  });

  it('drop what a lower cut hides from the selection, so Delete never takes it', () => {
    const ctx = contextOf(planOf(raw('low', 'woodwall', 1), raw('high', 'woodwall', 3)));
    const both = [
      { kind: 'raw', id: 'low' },
      { kind: 'raw', id: 'high' },
    ] as const;
    ctx.set(selectionAtom, [...both]);
    setCut(ctx, 2);
    expect(ctx.get(selectionAtom)).toEqual([both[0]]);
    // Selected some other way while hidden: Delete leaves it.
    ctx.set(selectionAtom, [both[1]]);
    expect(deleteSelection(ctx)).toBe(false);
    expect(ctx.plan.getPlan().rawPieces.high).toBeDefined();
  });

  it('toggle All: back to the last cut, else the highest stop; a reset forgets it', () => {
    const ctx = contextOf(storeys);
    setCut(ctx, 2);
    toggleAll(ctx);
    expect(ctx.get(cutHeightAtom)).toBeNull();
    toggleAll(ctx);
    expect(ctx.get(cutHeightAtom)).toBe(2);
    resetCut(ctx);
    toggleAll(ctx);
    expect(ctx.get(cutHeightAtom)).toBeCloseTo(4.5, 1);
  });

  it('New resets the cut and the last cut', () => {
    // Node has no DOM: nothing is focused.
    vi.stubGlobal('document', { activeElement: null });
    vi.stubGlobal('HTMLElement', class {});
    const ctx = contextOf();
    setCut(ctx, 4);
    startNewPlan(ctx);
    vi.unstubAllGlobals();
    expect(ctx.get(cutHeightAtom)).toBeNull();
    expect(ctx.get(lastCutAtom)).toBeNull();
  });

  it('jump between stops only when there are some', () => {
    const ctx = contextOf(planOf(raw('w', 'woodwall', 1)));
    setCut(ctx, 2);
    jumpStop(ctx, 1);
    jumpStop(ctx, -1);
    expect(ctx.get(cutHeightAtom)).toBe(2);
  });
});
