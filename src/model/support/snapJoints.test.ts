import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { boxSnapPoints } from '../build/snapPoints';
import { rawBox } from '../rawBoxes';
import type { RawPiece } from '../types';

import { planSupport } from './planSupport';
import { snapJoints } from './snapJoints';

const raw = (id: string, prefab: string, x: number, y: number, z: number, yaw = 0): RawPiece => ({
  id,
  prefab,
  position: { x, y, z },
  rotation: { yaw, pitch: 0, roll: 0 },
  elevation: 0,
});

const supportOf = (pieces: readonly RawPiece[], joints: boolean) => {
  const boxes = pieces.map((p) => rawBox(p, testLibrary));
  const pairs = joints ? snapJoints(boxes, testLibrary).pairs : [];
  return planSupport(boxes, testLibrary.catalog.materialSupport, pairs);
};

describe('snapJoints', () => {
  /**
   * Two 45° wood slopes on wood walls, eaves 6 m apart, and the ridge cap between their
   * tops: its colliders meet the slopes along edges only.
   */
  const roof = [
    raw('wallA', 'woodwall', 0, 1, -1),
    raw('slopeA', 'wood_roof_45', 0, 3, 0),
    raw('wallB', 'woodwall', 0, 1, 5),
    raw('slopeB', 'wood_roof_45', 0, 3, 4, 180),
    raw('cap', 'wood_roof_top_45', 0, 4, 2),
  ];

  it('joins pieces whose snap points meet, each pair once', () => {
    const boxes = roof.map((p) => rawBox(p, testLibrary));
    const keys = snapJoints(boxes, testLibrary).pairs.map((pair) => [...pair].sort().join(' '));
    expect(keys.sort()).toEqual([
      'raw:cap raw:slopeA',
      'raw:cap raw:slopeB',
      'raw:slopeA raw:wallA',
      'raw:slopeB raw:wallB',
    ]);
    // The cap's lower snap points sit on the slopes' top edges.
    const cap = boxSnapPoints(boxes[4]!, testLibrary).filter((p) => p.y < 4.01);
    expect(cap.map((p) => p.z).sort()).toEqual([1, 1, 3, 3]);
  });

  it('holds a ridge cap on two 45° slopes up through its joints', () => {
    expect(supportOf(roof, false).byKey.get('raw:cap')?.state).toBe('collapsing');
    const held = supportOf(roof, true).byKey.get('raw:cap')!;
    expect(held.state).toBe('supported');
    expect(held.value).toBeGreaterThan(10);
  });

  it('checks raw pieces: a raw wood wall column breaks at the 9th', () => {
    const column = Array.from({ length: 9 }, (_, i) => raw(`w${i}`, 'woodwall', 0, 1 + 2 * i, 0));
    const { byKey, collapsing } = supportOf(column, true);
    expect(byKey.get('raw:w0')?.state).toBe('grounded');
    expect(byKey.get('raw:w7')?.state).toBe('supported');
    expect(byKey.get('raw:w8')?.state).toBe('collapsing');
    expect(collapsing).toEqual([{ item: { kind: 'raw', id: 'w8' }, count: 1 }]);
  });
});
