import { describe, expect, it } from 'vitest';

import { filterPieces, pieceSizeLabel, type BuildCategory } from './buildPalette';
import { testLibrary } from './testLibrary';

const pieces = testLibrary.catalog.pieces;
const prefabs = (query: string, category: BuildCategory | null = null) =>
  filterPieces(pieces.values(), query, category, null).map((d) => d.prefab);

describe('buildPalette', () => {
  it('searches EN and PL names (diacritics folded) and prefabs', () => {
    expect(prefabs('wood wall')).toContain('woodwall');
    expect(prefabs('drewniana sciana')).toContain('woodwall');
    expect(prefabs('stone_floor_2x2')).toEqual(['stone_floor_2x2']);
  });

  it('filters by category and material, and leaves the repair tool out', () => {
    const stone = filterPieces(pieces.values(), '', 'heavy-building', 'stone');
    expect(stone.length).toBeGreaterThan(0);
    expect(stone.every((d) => d.category === 'heavy-building' && d.material === 'stone')).toBe(
      true
    );
    const coreWood = filterPieces(pieces.values(), '', null, 'hardwood');
    expect(coreWood.every((d) => d.material === 'hardwood')).toBe(true);
    expect(filterPieces(pieces.values(), 'repair', null, null)).toEqual([]);
    expect(prefabs('', 'other')).not.toContain('piece_repair');
  });

  it('labels snap sizes', () => {
    expect(pieceSizeLabel(pieces.get('woodwall')!)).toBe('2 × 2 m');
    expect(pieceSizeLabel(pieces.get('wood_floor')!)).toBe('2 × 2 m');
    expect(pieceSizeLabel(pieces.get('wood_pole2')!)).toBe('2 m');
  });
});
