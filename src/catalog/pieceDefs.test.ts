import { describe, expect, it } from 'vitest';

import rawPieces from '../../research/valheim-pieces.json';

import { itemLabel, parseItems } from './items';
import { parseCatalog } from './pieceDefs';
import { testLibrary } from './testLibrary';

describe('parseCatalog', () => {
  const catalog = parseCatalog(rawPieces);

  it('loads every hammer piece once', () => {
    expect(catalog.pieces.size).toBe(398);
  });

  it('parses a wood wall', () => {
    expect(catalog.pieces.get('woodwall')).toMatchObject({
      name: 'Wood Wall',
      category: 'building',
      station: 'piece_workbench',
      material: 'wood',
      health: 400,
      resources: [{ item: 'Wood', amount: 2 }],
      colliderSize: [2, 2, 0.3],
    });
    expect(catalog.pieces.get('woodwall')?.snapPoints).toHaveLength(4);
  });

  it("maps a non-string category to 'unknown'", () => {
    expect(catalog.pieces.get('piece_repair')?.category).toBe('unknown');
  });

  it('throws on a malformed shape', () => {
    expect(() => parseCatalog({ meta: {}, pieces: 'nope' })).toThrow(/\$\.pieces/);
  });
});

describe('items', () => {
  it('names resources from the extract, falling back to the id', () => {
    expect(itemLabel(testLibrary, 'RoundLog')).toBe('Corewood');
    expect(itemLabel(testLibrary, 'NotAnItem')).toBe('NotAnItem');
    expect(() => parseItems({ Wood: { name: 'Wood' } })).toThrow(/namePl/);
  });
});
