import { describe, expect, it } from 'vitest';

import { emptyPlan, type RawPiece } from '../model/types';

import { createPlanStore } from './planStore';

const piece = (id: string): RawPiece => ({
  id,
  prefab: 'woodwall',
  position: { x: 0, y: 0, z: 0 },
  rotation: { yaw: 0, pitch: 0, roll: 0 },
  elevation: 0,
});

const ids = (store: ReturnType<typeof createPlanStore>) => Object.keys(store.getPlan().rawPieces);

describe('planStore', () => {
  it('dispatches, undoes and redoes', () => {
    const store = createPlanStore(emptyPlan());
    store.dispatch({ type: 'raw.insert', piece: piece('a') }, { label: 'Add piece' });
    expect(ids(store)).toEqual(['a']);
    expect(store.peekUndoLabel()).toBe('Add piece');
    expect(store.undo()).toBe(true);
    expect(ids(store)).toEqual([]);
    expect(store.redo()).toBe(true);
    expect(ids(store)).toEqual(['a']);
  });

  it('records a transaction as one entry', () => {
    const store = createPlanStore(emptyPlan());
    store.transact('Two pieces', (dispatch) => {
      dispatch({ type: 'raw.insert', piece: piece('a') });
      dispatch({ type: 'raw.insert', piece: piece('b') });
    });
    store.undo();
    expect(ids(store)).toEqual([]);
    expect(store.canUndo()).toBe(false);
  });

  it('clears redo on a new edit and skips no-ops', () => {
    const store = createPlanStore(emptyPlan());
    store.dispatch({ type: 'raw.insert', piece: piece('a') });
    store.undo();
    store.dispatch({ type: 'raw.insert', piece: piece('b') });
    expect(store.canRedo()).toBe(false);
    store.dispatch({ type: 'raw.patch', id: 'b', changes: { elevation: 0 } });
    store.undo();
    expect(store.canUndo()).toBe(false);
  });

  it('leaves the plan unchanged when a command fails', () => {
    const store = createPlanStore(emptyPlan());
    store.dispatch({ type: 'raw.insert', piece: piece('a') });
    const before = store.getPlan();
    const result = store.transact('Bad', (dispatch) => {
      dispatch({ type: 'raw.remove', id: 'a' });
      dispatch({ type: 'raw.remove', id: 'a' });
    });
    expect(result.ok).toBe(false);
    expect(store.getPlan()).toBe(before);
  });

  it('lists history labels in order, with a stable snapshot', () => {
    const store = createPlanStore(emptyPlan());
    for (const id of ['a', 'b', 'c']) {
      store.dispatch({ type: 'raw.insert', piece: piece(id) }, { label: `Add ${id}` });
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
    for (const id of ['a', 'b', 'c']) store.dispatch({ type: 'raw.insert', piece: piece(id) });
    while (store.undo());
    expect(ids(store)).toEqual(['a']);
    store.load(emptyPlan());
    expect([store.canUndo(), store.canRedo()]).toEqual([false, false]);
  });
});
