import { describe, expect, it } from 'vitest';

import { testLibrary } from '../catalog/testLibrary';

import { PANEL_THICKNESS, rawBox } from './rawBoxes';
import type { RawPiece } from './types';

const raw = (prefab: string, pitch = 0): RawPiece => ({
  id: prefab,
  prefab,
  position: { x: 0, y: 3, z: 0 },
  rotation: { yaw: 0, pitch, roll: 0 },
});

describe('rawBox', () => {
  it('marks imported roof covers, tilted or not, to hide with the Roofs toggle', () => {
    const covers = ['wood_roof', 'wood_roof_top_45', 'wood_roof_ocorner'].map(raw);
    covers.push(raw('wood_roof_45', 10));
    for (const piece of covers) expect(rawBox(piece, testLibrary).roofCover).toBe(true);
  });

  it('keeps gable walls (the Roof Cross too) and other pieces shown', () => {
    for (const prefab of ['wood_wall_roof_a', 'wood_wall_roof_top', 'woodwall']) {
      expect(rawBox(raw(prefab), testLibrary).roofCover).toBeUndefined();
    }
  });

  it('draws a door or gate as its thin panel, as in a drawn wall', () => {
    for (const prefab of ['wood_door', 'wood_gate', 'iron_grate']) {
      expect(rawBox(raw(prefab), testLibrary).size.z).toBe(PANEL_THICKNESS);
    }
    expect(rawBox(raw('woodwall'), testLibrary).size.z).toBeCloseTo(0.3);
  });
});
