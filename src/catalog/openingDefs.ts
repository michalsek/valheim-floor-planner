/**
 * Doors, gates and grates that can be cut into a wall: each wall family's own
 * openings plus a few generic ones any family can take.
 */
import type { Catalog } from './pieceDefs';
import { toOpening, type WallFamily } from './wallFamilies';

export type OpeningKind = 'door' | 'gate' | 'grate';

export interface OpeningDef {
  prefab: string;
  label: string;
  width: number;
  height: number;
  /** The prefab's own material (a hardwood gate in a stone wall stays hardwood). */
  material: string;
  kind: OpeningKind;
}

/** Openings every wall family offers. */
const GENERIC_OPENINGS: readonly string[] = ['iron_grate', 'darkwood_gate'];

/**
 * Heights the snap points get wrong. The ashwood door snaps 2 m high but its collider
 * is 3.01 m (to verify in game).
 */
const HEIGHT_OVERRIDES: Readonly<Record<string, number>> = { ashwood_door: 3 };

const kindOf = (prefab: string): OpeningKind => {
  if (/door/i.test(prefab)) return 'door';
  if (/grate/i.test(prefab)) return 'grate';
  return 'gate';
};

/** Every opening of every family, plus the generic ones, once each, keyed by prefab. */
export const deriveOpeningDefs = (
  catalog: Catalog,
  families: readonly WallFamily[]
): Map<string, OpeningDef> => {
  const prefabs = new Set([
    ...families.flatMap((f) => f.openings.map((o) => o.prefab)),
    ...GENERIC_OPENINGS,
  ]);
  return new Map(
    [...prefabs].map((prefab) => {
      const piece = catalog.pieces.get(prefab);
      if (!piece) throw new Error(`Opening: unknown prefab "${prefab}"`);
      const { width, height } = toOpening(piece);
      if (width <= 0 || height <= 0) throw new Error(`Opening "${prefab}" has no size`);
      const def: OpeningDef = {
        prefab,
        label: piece.name,
        width,
        height: HEIGHT_OVERRIDES[prefab] ?? height,
        material: piece.material ?? 'wood',
        kind: kindOf(prefab),
      };
      return [prefab, def];
    })
  );
};

/** What a wall of `family` offers in the picker: its own openings, then the generic ones. */
export const openingChoicesFor = (
  defs: ReadonlyMap<string, OpeningDef>,
  family: WallFamily | undefined
): OpeningDef[] =>
  [...(family?.openings.map((o) => o.prefab) ?? []), ...GENERIC_OPENINGS].flatMap((prefab) => {
    const def = defs.get(prefab);
    return def ? [def] : [];
  });
