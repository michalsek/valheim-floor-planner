import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';

import { paletteResults } from './paletteState';
import { pieceGlyph } from './pieceGlyph';

const glyphOf = (prefab: string) => {
  const def = testLibrary.catalog.pieces.get(prefab);
  if (!def) throw new Error(prefab);
  return pieceGlyph(def, testLibrary);
};

describe('pieceGlyph', () => {
  it('draws a box as its three visible faces, each outlined by four edges', () => {
    const glyph = glyphOf('woodwall');
    expect(glyph?.faces.map((f) => f.tone).sort()).toEqual(['left', 'right', 'top']);
    for (const face of glyph?.faces ?? []) expect(face.edges.match(/M/g)).toHaveLength(4);
  });

  it('fits the longer side to 100 units, with a margin', () => {
    const [x, y, w, h] = (glyphOf('wood_floor')?.viewBox ?? '').split(' ').map(Number);
    expect(x).toBeCloseTo(-6);
    expect(y).toBeCloseTo(-6);
    expect(Math.max(w!, h!)).toBeCloseTo(112);
  });

  it('draws roof pieces as their roof shape, slopes facing the viewer', () => {
    for (const prefab of ['wood_roof', 'wood_roof_45', 'wood_roof_67']) {
      const glyph = glyphOf(prefab);
      expect(glyph?.faces.map((f) => f.tone)).toContain('top');
      // Not edge-on: the slope fills the glyph, not a sliver of it.
      const [, , w, h] = (glyph?.viewBox ?? '').split(' ').map(Number);
      expect(Math.min(w!, h!) / Math.max(w!, h!)).toBeGreaterThan(0.4);
    }
    expect(glyphOf('wood_roof_ocorner_45')?.faces.length).toBeGreaterThan(0);
  });
});

describe('paletteResults', () => {
  const pieces = testLibrary.catalog.pieces;

  it('lists Recent in the order armed, and searches every category', () => {
    const recent = { tab: 'recent', query: '', material: null } as const;
    expect(
      paletteResults(pieces, ['wood_floor', 'woodwall', 'gone'], recent).map((d) => d.prefab)
    ).toEqual(['wood_floor', 'woodwall']);
    const search = paletteResults(pieces, [], { ...recent, tab: 'crafting', query: 'wood wall' });
    expect(search[0]?.prefab).toBe('woodwall');
  });
});
