import type { Catalog } from '../catalog/pieceDefs';

export interface BomPieceLine {
  prefab: string;
  name: string;
  count: number;
}

export interface BomResourceLine {
  item: string;
  amount: number;
}

/** Bill of materials: piece counts and the resources they cost. */
export interface Bom {
  pieces: BomPieceLine[];
  resources: BomResourceLine[];
}

/** Largest first, then by name. */
const byCount = (a: number, b: number, nameA: string, nameB: string): number =>
  b - a || nameA.localeCompare(nameB);

/** Counts `entries` by prefab: props and raw pieces alike. */
export const computeBom = (entries: readonly { prefab: string }[], catalog: Catalog): Bom => {
  const counts = new Map<string, number>();
  for (const { prefab } of entries) counts.set(prefab, (counts.get(prefab) ?? 0) + 1);

  const resources = new Map<string, number>();
  for (const [prefab, count] of counts) {
    for (const { item, amount } of catalog.pieces.get(prefab)?.resources ?? []) {
      resources.set(item, (resources.get(item) ?? 0) + amount * count);
    }
  }

  return {
    pieces: [...counts]
      .map(([prefab, count]) => ({
        prefab,
        name: catalog.pieces.get(prefab)?.name ?? prefab,
        count,
      }))
      .sort((a, b) => byCount(a.count, b.count, a.name, b.name)),
    resources: [...resources]
      .map(([item, amount]) => ({ item, amount }))
      .sort((a, b) => byCount(a.amount, b.amount, a.item, b.item)),
  };
};
