import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import type { Roof, Vec2 } from '../types';

import { tileRoof } from './tileRoof';

const rect = (w: number, d: number): Vec2[] => [
  { x: 0, z: 0 },
  { x: w, z: 0 },
  { x: w, z: d },
  { x: 0, z: d },
];

/** An 8 × 8 thatch 26° gable on 2 m walls, 1 m eaves and gables, wood gable walls. */
const roof = (changes: Partial<Roof> = {}): Roof => ({
  id: 'r',
  elevation: 0,
  base: 2,
  outline: rect(8, 8),
  familyId: 'thatch',
  pitch: 26,
  kind: 'gable',
  ridgeAxis: 'x',
  lowSide: '-z',
  overhang: { eave: 1, gable: 1 },
  gableWalls: 'wood',
  ...changes,
});

const tile = (r: Roof) => {
  const { pieces, warnings } = tileRoof(r, testLibrary);
  const counts: Record<string, number> = {};
  for (const p of pieces) counts[p.role] = (counts[p.role] ?? 0) + 1;
  const cells = pieces.filter((p) => p.cell);
  return {
    counts,
    pieces,
    eave: Math.min(...cells.map((p) => p.center.y - p.size.y / 2)),
    ridge: Math.max(...cells.map((p) => p.center.y + p.size.y / 2)),
    messages: warnings.map((w) => w.message),
  };
};

describe('tileRoof', () => {
  it('roofs an 8 × 8 house at 26° with 20 straight and 5 ridge pieces, and fills its gables', () => {
    const { counts, eave, ridge, messages } = tile(roof());
    expect(counts).toEqual({ straight: 20, ridge: 5, gableTri: 8, gableRect: 4 });
    expect(eave).toBeCloseTo(1.5);
    expect(ridge).toBeCloseTo(4);
    expect(messages).toEqual([]);
  });

  it('puts a 45° eave 1 m out and 1 m down, and the ridge 4 m up', () => {
    const { eave, ridge } = tile(roof({ pitch: 45 }));
    expect(eave).toBeCloseTo(1);
    expect(ridge).toBeCloseTo(6);
  });

  it('hips an 8 × 12 house: 24 straight, 8 outer and 3 ridge pieces (2 hip apexes)', () => {
    const { counts, messages } = tile(roof({ kind: 'hip', outline: rect(12, 8) }));
    expect(counts).toEqual({ straight: 24, outer: 8, ridge: 3 });
    expect(messages).toEqual(['2 hip apex cells have no matching game piece; ridge used']);
  });

  it('puts valley pieces at an L-house’s re-entrant corner', () => {
    const outline = [
      { x: 0, z: 0 },
      { x: 16, z: 0 },
      { x: 16, z: 8 },
      { x: 8, z: 8 },
      { x: 8, z: 16 },
      { x: 0, z: 16 },
    ];
    const { pieces } = tile(roof({ kind: 'hip', outline }));
    const inner = pieces.filter((p) => p.role === 'inner');
    expect(inner.map((p) => p.prefab)).toEqual(['wood_roof_icorner', 'wood_roof_icorner']);
    // On the diagonal in from the re-entrant corner (9, 9) of the eave ring.
    expect(inner.map((p) => [p.center.x - p.center.z])).toEqual([[0], [0]]);
  });

  it('grows an odd span by 1 m on the far side and raises the far wall with log beams', () => {
    const { counts, pieces, messages } = tile(roof({ outline: rect(8, 7), gableWalls: 'none' }));
    expect(counts).toEqual({ straight: 20, ridge: 5, filler: 2 });
    const filler = pieces.filter((p) => p.role === 'filler');
    expect(filler.map((p) => p.prefab)).toEqual(['wood_wall_log_4x0.5', 'wood_wall_log_4x0.5']);
    // On the far wall (z = 7), from the wall top (2 m) up to the roof, 0.5 m higher.
    expect(filler.every((p) => p.center.z === 7 && p.center.y === 2.25)).toBe(true);
    expect(messages).toEqual(['Odd span: far wall raised by 0.5 m (filler course added)']);
  });

  it("raises a shed roof's high wall to the roof", () => {
    const shed = roof({ kind: 'shed', lowSide: '-z', gableWalls: 'none' });
    const filler = tile(shed).pieces.filter((p) => p.role === 'filler');
    // 8 m of run up from the low wall at 26°: a 4 m course on the high wall (z = 8).
    expect(filler.every((p) => p.center.z === 8)).toBe(true);
    expect(Math.max(...filler.map((p) => p.center.y + p.size.y / 2))).toBeCloseTo(6);
  });

  it('leaves grausten hip corners and the ridge open, with warnings', () => {
    const grausten = roof({ familyId: 'grausten', pitch: 45, kind: 'hip' });
    const { counts, messages } = tile(grausten);
    expect(counts).toEqual({ straight: 16 });
    expect(messages).toContain('Grausten has no hip corner piece: 8 corners left open');
    expect(messages).toContain(
      'Grausten has no ridge piece: use an overhang that makes the half-run even'
    );
  });
});
