import { describe, expect, it } from 'vitest';

import goldens from '../../../../research/terrainGoldens.json';

import { decodePregenerated, encodePregenerated, lakesHash, riversHash } from './pregenCodec';
import { pregenerate, restoreRivers, withDeepNorth } from './pregenerate';
import { cellKey } from './rivers';
import { WorldGenerator } from './worldGenerator';

describe.each(goldens.worlds)('pregeneration, synthetic seed $seed', (g) => {
  const gen = new WorldGenerator(g.seed, g.worldGenVersion);
  const pre = pregenerate(gen, { deepNorth: false });
  const full = new Map(gen.rivers.cells);

  it('places the same lakes, rivers and streams as worldGen.py', () => {
    const counts = [pre.lakes.length, pre.rivers.length, pre.streams.length];
    expect(counts).toEqual([g.pregen.lakes, g.pregen.rivers, g.pregen.streams]);
    const hashes = [lakesHash(pre.lakes), riversHash(pre.rivers), riversHash(pre.streams)];
    const { lakes, rivers, streams } = g.pregen.hashes;
    expect(hashes).toEqual([lakes, rivers, streams]);
    expect([pre.states.rivers, pre.states.streams]).toEqual([
      g.pregen.states.rivers,
      g.pregen.states.streams,
    ]);
    expect(gen.rivers.size).toBe(g.pregen.cellEntries.withoutDeepNorth);
  });

  it('round-trips through the cache codec', () => {
    expect(decodePregenerated(encodePregenerated(pre))).toEqual(pre);
  });

  it('restores only the asked cells, each exactly as the full render', () => {
    const keys = [...full.keys()].filter((_, i) => i % 37 === 0);
    const cells = new Set([...keys, cellKey(10_000, 10_000)]);
    restoreRivers(gen, pre, cells);
    expect([...gen.rivers.cells.keys()].sort()).toEqual([...keys].sort());
    for (const k of keys) expect(gen.rivers.cells.get(k)).toEqual(full.get(k));
  });

  it('adds the Deep North pass later, as one pregeneration would', () => {
    const deep = withDeepNorth(gen, pre);
    expect(deep.deepStreams?.length).toBe(g.pregen.deepStreams);
    expect(riversHash(deep.deepStreams ?? [])).toBe(g.pregen.hashes.deepStreams);
    expect(deep.states.deepStreams).toEqual(g.pregen.states.deepStreams);
    expect(gen.rivers.size).toBe(g.pregen.cellEntries.all);
    expect(decodePregenerated(encodePregenerated(deep))).toEqual(deep);
  });

  it('matches GetHeight beside rivers and streams', () => {
    for (const [x, z, h] of g.riverHeights) {
      expect(Math.abs(gen.getHeight(x!, z!) - h!)).toBeLessThanOrEqual(1e-4);
    }
  });
});
