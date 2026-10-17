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
  elevation: 0,
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

  it('lists history labels in order, with a stable snapshot', () => {
    const store = createPlanStore(emptyPlan());
    for (const id of ['a', 'b', 'c']) {
      store.dispatch({ type: 'wall.insert', wall: wall(id) }, { label: `Add ${id}` });
    }
    store.undo();
    store.undo();
    const labels = store.historyLabels();
    expect(labels).toEqual({ undo: ['Add a'], redo: ['Add b', 'Add c'], truncated: false });
    expect(store.historyLabels()).toBe(labels);
    store.dispatch({ type: 'plan.rename', name: 'Hall' });
    expect(store.historyLabels()).toMatchObject({ undo: ['Add a', 'Rename plan'], redo: [] });
  });

  it('keeps at most historyLimit entries, and load clears history', () => {
    const store = createPlanStore(emptyPlan(), { historyLimit: 2 });
    for (const id of ['a', 'b', 'c']) store.dispatch({ type: 'wall.insert', wall: wall(id) });
    while (store.undo());
    expect(ids(store)).toEqual(['a']);
    store.load(emptyPlan());
    expect([store.canUndo(), store.canRedo()]).toEqual([false, false]);
  });

  it('deletes a wall with its openings, and one undo restores both', () => {
    const store = createPlanStore(emptyPlan());
    store.dispatch({ type: 'wall.insert', wall: wall('a') });
    const opening = { id: 'o', wallId: 'a', prefab: 'wood_door', at: { x: 1, z: 0 } };
    store.dispatch({ type: 'opening.insert', opening });
    store.dispatch({ type: 'wall.remove', id: 'a' });
    expect(store.getPlan().openings).toEqual({});
    store.undo();
    expect(store.getPlan().openings).toEqual({ o: opening });
    expect(ids(store)).toEqual(['a']);
  });
});
