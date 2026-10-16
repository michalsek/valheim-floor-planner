/**
 * Build and ward radii. The extract has each station's base radius and per-upgrade
 * step; the upgrade maximum is kept by hand, since the data's `station` field on
 * extension pieces names the station needed to build them, not the one they upgrade.
 */
import type { Catalog } from './pieceDefs';

const STATION_MAX_UPGRADES: Record<string, number> = {
  piece_workbench: 4,
  forge: 6,
  blackforge: 5,
  piece_magetable: 4,
  piece_cauldron: 6,
  piece_artisanstation: 1,
};

const WARD_PREFAB = 'guard_stone';

export interface PropRadius {
  kind: 'build' | 'ward';
  radius: number;
  base: number;
  perUpgrade: number;
  /** 0 when the station has no upgrades. */
  maxUpgrades: number;
}

/** The ring a prop draws: a station's build radius with `upgrades`, or the ward's. */
export const propRadius = (
  prefab: string,
  upgrades: number,
  catalog: Pick<Catalog, 'stationBuildRange' | 'wardRadius'>
): PropRadius | null => {
  if (prefab === WARD_PREFAB) {
    const r = catalog.wardRadius;
    return { kind: 'ward', radius: r, base: r, perUpgrade: 0, maxUpgrades: 0 };
  }
  const range = catalog.stationBuildRange[prefab];
  if (!range) return null;
  const maxUpgrades = range.perUpgrade > 0 ? (STATION_MAX_UPGRADES[prefab] ?? 0) : 0;
  const n = Math.min(Math.max(0, Math.round(upgrades)), maxUpgrades);
  return {
    kind: 'build',
    radius: range.baseRadius + n * range.perUpgrade,
    base: range.baseRadius,
    perUpgrade: range.perUpgrade,
    maxUpgrades,
  };
};
