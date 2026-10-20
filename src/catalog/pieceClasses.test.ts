import { describe, expect, it } from 'vitest';

import { DOOR_PREFABS, FLOOR_TILE_PREFABS } from './pieceClasses';
import { testLibrary } from './testLibrary';

describe('piece classes', () => {
  it('lists only prefabs the catalogue has', () => {
    const missing = [...FLOOR_TILE_PREFABS, ...DOOR_PREFABS].filter(
      (prefab) => !testLibrary.catalog.pieces.has(prefab)
    );
    expect(missing).toEqual([]);
  });
});
