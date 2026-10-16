import { describe, expect, it } from 'vitest';

import { emptyPlan, type WallRun } from '../model/types';

import { createPlanStore } from './planStore';

const wall = (id: string): WallRun => ({
  id,
  familyId: 'wood',
  points: [
    { x: 0, z: 0 },
    { x: 2, z: 0 },
  ],
  closed: false,
  side: 'right',
  height: 2,
});

const ids = (store: ReturnType<typeof createPlanStore>) => Object.keys(store.getPlan().walls);

describe('planStore', () => {
  it('dispatches, undoes and redoes', () => {
    const store = createPlanStore(emptyPlan());
    store.dispatch({ type: 'wall.insert', wall: wall('a') }, { label: 'Add wall' });
    expect(ids(store)).toEqual(['a']);
    expect(store.peekUndoLabel()).toBe('Add wall');
    expect(store.undo()).toBe(true);
    expect(ids(store)).toEqual([]);
    expect(store.redo()).toBe(true);
    expect(ids(store)).toEqual(['a']);
  });

  it('records a transaction as one entry', () => {
    const store = createPlanStore(emptyPlan());
    store.transact('Two walls', (dispatch) => {
      dispatch({ type: 'wall.insert', wall: wall('a') });
      dispatch({ type: 'wall.insert', wall: wall('b') });
    });
    store.undo();
    expect(ids(store)).toEqual([]);
    expect(store.canUndo()).toBe(false);
  });

  it('clears redo on a new edit and skips no-ops', () => {
    const store = createPlanStore(emptyPlan());
    store.dispatch({ type: 'wall.insert', wall: wall('a') });
    store.undo();
    store.dispatch({ type: 'wall.insert', wall: wall('b') });
    expect(store.canRedo()).toBe(false);
    store.dispatch({ type: 'wall.patch', id: 'b', changes: { height: 2 } });
    store.undo();
    expect(store.canUndo()).toBe(false);
  });

  it('leaves the plan unchanged when a command fails', () => {
    const store = createPlanStore(emptyPlan());
    store.dispatch({ type: 'wall.insert', wall: wall('a') });
    const before = store.getPlan();
    const result = store.transact('Bad', (dispatch) => {
      dispatch({ type: 'wall.remove', id: 'a' });
      dispatch({ type: 'wall.remove', id: 'a' });
    });
    expect(result.ok).toBe(false);
    expect(store.getPlan()).toBe(before);
  });

  it('keeps at most historyLimit entries, and load clears history', () => {
    const store = createPlanStore(emptyPlan(), { historyLimit: 2 });
    for (const id of ['a', 'b', 'c']) store.dispatch({ type: 'wall.insert', wall: wall(id) });
    while (store.undo());
    expect(ids(store)).toEqual(['a']);
    store.load(emptyPlan());
    expect([store.canUndo(), store.canRedo()]).toEqual([false, false]);
  });
});
