import { describe, expect, it } from 'vitest';

import { APPROX_RECT, filterProps, type PropGroup } from './propDefs';
import { propRadius } from './stations';
import { testLibrary } from './testLibrary';

const { catalog, propDefs: propDefByPrefab } = testLibrary;
const propDefs = [...propDefByPrefab.values()];

const NO_GROUPS = new Set<PropGroup>();
const search = (query: string) => filterProps(propDefs, query, NO_GROUPS).map((d) => d.prefab);

describe('propDefs', () => {
  it('keeps building pieces out and furnishing Deep North pieces in', () => {
    for (const prefab of ['woodwall', 'wood_floor', 'stave_wall_2x2', 'piece_repair']) {
      expect(propDefByPrefab.has(prefab)).toBe(false);
    }
    expect(propDefByPrefab.get('piece_chair_runed')?.group).toBe('furniture');
    expect(propDefs.filter((d) => d.group === 'ships')).toHaveLength(4);
  });

  it('searches EN, PL with or without diacritics, and prefabs', () => {
    for (const query of ['ława', 'lawa']) {
      expect(search(query)).toEqual(
        expect.arrayContaining(['piece_bench01', 'piece_blackmarble_bench'])
      );
    }
    for (const query of ['stół', 'stol']) {
      expect(search(query)).toEqual(
        expect.arrayContaining(['piece_artisanstation', 'piece_magetable'])
      );
    }
    expect(search('piece_chest')).toContain('piece_chest_wood');
    expect(search('workbench')[0]).toBe('piece_workbench');
    expect(search('zzzz')).toEqual([]);
    expect(filterProps(propDefs, '', new Set<PropGroup>(['ships']))).toHaveLength(4);
  });

  it('gives a piece without a collider an approximate 1 × 1 footprint', () => {
    expect(propDefByPrefab.get('piece_cauldron')).toMatchObject({
      rect: APPROX_RECT,
      approximate: true,
    });
  });
});

describe('propRadius', () => {
  it('adds upgrades to a station base radius; the ward has its own', () => {
    expect(propRadius('piece_workbench', 2, catalog)?.radius).toBe(28);
    expect(propRadius('piece_stonecutter', 3, catalog)).toMatchObject({
      radius: 20,
      maxUpgrades: 0,
    });
    expect(propRadius('guard_stone', 0, catalog)).toMatchObject({ kind: 'ward', radius: 32 });
    expect(propRadius('piece_chest_wood', 0, catalog)).toBeNull();
  });
});
