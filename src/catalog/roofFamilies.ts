/**
 * Roof families: which roof prefabs belong together, per pitch, and the triangle
 * walls that fill a gable. The rise per metre of run (k) comes from the straight
 * piece's snap points; a pitch whose prefabs aren't in the catalogue is left out
 * (older installs lack the 67° Deep North pieces).
 *
 * Piece local space (from the snap points, in planner space: the game's z mirrored): x
 * along the eave (±1), z up the slope (+1 high, −1 low), y up. Every piece covers 2 m
 * along the eave by 2 m of run.
 */
import { snapExtent, type Catalog } from './pieceDefs';

export const ROOF_PITCHES = [26, 45, 67] as const;
export type RoofPitch = (typeof ROOF_PITCHES)[number];

export interface RoofPitchPieces {
  /** Rise per metre of run: 0.5, 1 and 2 for 26°, 45° and 67°. */
  k: number;
  straight: string;
  /** The ridge row piece (1 m of run each side of the apex); null when there is none. */
  ridge: string | null;
  /** The hip (outer) corner; null when there is none. */
  outer: string | null;
  /** The valley (inner) corner; null when there is none. */
  inner: string | null;
}

export interface RoofFamily {
  id: string;
  label: string;
  material: string;
  /** The pitches this install can build, lowest first. */
  pitches: ReadonlyMap<RoofPitch, RoofPitchPieces>;
}

interface PitchSpec {
  straight: string;
  ridge: string | null;
  outer: string | null;
  inner: string | null;
}

export interface RoofFamilySpec {
  id: string;
  label: string;
  pitches: Partial<Record<RoofPitch, PitchSpec>>;
}

/** The thatch and shingle families share one layout; only the prefix differs. */
const woodLike = (prefix: string): Partial<Record<RoofPitch, PitchSpec>> => ({
  26: {
    straight: prefix,
    ridge: `${prefix}_top`,
    outer: `${prefix}_ocorner`,
    inner: `${prefix}_icorner`,
  },
  45: {
    straight: `${prefix}_45`,
    ridge: `${prefix}_top_45`,
    outer: `${prefix}_ocorner_45`,
    inner: `${prefix}_icorner_45`,
  },
  67: {
    straight: `${prefix}_67`,
    ridge: `${prefix}_top_67`,
    outer: `${prefix}_ocorner_67`,
    inner: `${prefix}_icorner_67`,
  },
});

export const ROOF_FAMILY_SPECS: readonly RoofFamilySpec[] = [
  { id: 'thatch', label: 'Thatch', pitches: woodLike('wood_roof') },
  { id: 'shingle', label: 'Darkwood shingle', pitches: woodLike('darkwood_roof') },
  {
    id: 'grausten',
    label: 'Grausten',
    pitches: {
      // Its two corner pieces are triangles with a high edge and a low point, which
      // don't make a hip corner (docs/Findings.md, M12): grausten has no corner pieces.
      45: { straight: 'piece_grausten_roof_45', ridge: null, outer: null, inner: null },
    },
  },
];

const has = (catalog: Catalog, prefab: string | null): boolean =>
  prefab !== null && catalog.pieces.has(prefab);

const derivePitch = (catalog: Catalog, spec: PitchSpec): RoofPitchPieces | null => {
  const straight = catalog.pieces.get(spec.straight);
  if (!straight) return null;
  const run = snapExtent(straight, 'z');
  if (run <= 0) return null;
  return {
    k: Math.round((snapExtent(straight, 'y') / run) * 100) / 100,
    straight: spec.straight,
    ridge: has(catalog, spec.ridge) ? spec.ridge : null,
    outer: has(catalog, spec.outer) ? spec.outer : null,
    inner: has(catalog, spec.inner) ? spec.inner : null,
  };
};

/** The families this catalogue can build (at least one pitch each). */
export const deriveRoofFamilies = (
  catalog: Catalog,
  specs: readonly RoofFamilySpec[]
): RoofFamily[] =>
  specs.flatMap((spec) => {
    const pitches = new Map<RoofPitch, RoofPitchPieces>();
    for (const pitch of ROOF_PITCHES) {
      const pitchSpec = spec.pitches[pitch];
      const pieces = pitchSpec && derivePitch(catalog, pitchSpec);
      if (pieces) pitches.set(pitch, pieces);
    }
    const [first] = pitches.values();
    const material = first && catalog.pieces.get(first.straight)?.material;
    return material ? [{ id: spec.id, label: spec.label, material, pitches }] : [];
  });

export type GableWallsId = 'wood' | 'ashwood';

/** Triangle walls under a gable, and the wall family the rectangles below them come from. */
export interface GableWallSet {
  id: GableWallsId;
  label: string;
  /** The wall family for the rectangles under the triangles. */
  wallFamilyId: string;
  /** Right triangles, 2 m long, rising 2k towards local +x. */
  triangles: ReadonlyMap<RoofPitch, string>;
  /** The "Roof Cross" piece for a column across the ridge (shape unverified in game). */
  peaks: ReadonlyMap<RoofPitch, string>;
}

interface GableWallSpec {
  id: GableWallsId;
  label: string;
  wallFamilyId: string;
  triangles: Record<RoofPitch, string>;
  peaks: Partial<Record<RoofPitch, string>>;
}

export const GABLE_WALL_SPECS: readonly GableWallSpec[] = [
  {
    id: 'wood',
    label: 'Wood',
    wallFamilyId: 'wood',
    triangles: { 26: 'wood_wall_roof_a', 45: 'wood_wall_roof_45', 67: 'wood_wall_roof_67_a' },
    peaks: { 26: 'wood_wall_roof_top', 45: 'wood_wall_roof_top_45', 67: 'wood_wall_roof_top_67' },
  },
  {
    id: 'ashwood',
    label: 'Ashwood',
    wallFamilyId: 'ashwood',
    triangles: {
      26: 'ashwood_wall_roof_26',
      45: 'ashwood_wall_roof_45',
      67: 'ashwood_wall_roof_67_a',
    },
    peaks: {},
  },
];

const presentPieces = (
  catalog: Catalog,
  byPitch: Partial<Record<RoofPitch, string>>
): ReadonlyMap<RoofPitch, string> =>
  new Map(
    ROOF_PITCHES.flatMap((pitch) => {
      const prefab = byPitch[pitch];
      return prefab && catalog.pieces.has(prefab) ? [[pitch, prefab] as const] : [];
    })
  );

export const deriveGableWallSets = (
  catalog: Catalog,
  specs: readonly GableWallSpec[]
): GableWallSet[] =>
  specs.map((spec) => ({
    id: spec.id,
    label: spec.label,
    wallFamilyId: spec.wallFamilyId,
    triangles: presentPieces(catalog, spec.triangles),
    peaks: presentPieces(catalog, spec.peaks),
  }));
