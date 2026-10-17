import { atom } from 'jotai';

import { DEFAULT_ROOF_FAMILY_ID } from '../../catalog';
import type { RoofPitch } from '../../catalog/roofFamilies';
import { formatCompact } from '../../format';
import { ringBox } from '../../model/geometry/rings';
import { roofProblem } from '../../model/roofs/roofCheck';
import { tileRoof, type RoofTiling } from '../../model/roofs/tileRoof';
import type { Roof, RoofKind, RoofOverhang, RoofSide, Vec2 } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';

/** The roof tool's settings (session state: never in history). */
export interface RoofSettings {
  familyId: string;
  pitch: RoofPitch;
  kind: RoofKind;
  /** The ridge's axis, or the long side ('auto'). */
  ridge: 'auto' | 'x' | 'z';
  /** A shed's low side, or the long side's lower one ('auto'). */
  lowSide: 'auto' | RoofSide;
  eave: RoofOverhang;
  gable: RoofOverhang;
  gableWalls: Roof['gableWalls'];
}

/** 1 m eaves and gables, as the user builds. */
export const roofSettingsAtom = atom<RoofSettings>({
  familyId: DEFAULT_ROOF_FAMILY_ID,
  pitch: 26,
  kind: 'gable',
  ridge: 'auto',
  lowSide: 'auto',
  eave: 1,
  gable: 1,
  gableWalls: 'wood',
});

/** What a click would roof: a room, a building, or a dragged rectangle (session state). */
export interface RoofDraft {
  outline: Vec2[];
  /** The wall tops' height above the level. */
  base: number;
  source: 'room' | 'building' | 'drag';
}

export const roofDraftAtom = atom<RoofDraft | null>(null);

/** The dragged rectangle's first corner, while dragging. */
export const roofDragStartAtom = atom<Vec2 | null>(null);

/** The pitch `settings` asks for, or the family's first when it has no such pieces. */
export const pitchFor = (familyId: string, pitch: RoofPitch): RoofPitch => {
  const pitches = getLibrary().roofFamilies.get(familyId)?.pitches;
  if (!pitches || pitches.has(pitch)) return pitch;
  return pitches.keys().next().value ?? pitch;
};

export const isRectangle = (outline: readonly Vec2[]): boolean => outline.length === 4;

/** The roof a draft makes with these settings, at `elevation`. */
export const roofFromDraft = (
  draft: RoofDraft,
  settings: RoofSettings,
  id: string,
  elevation: number
): Roof => {
  const { w, d } = ringBox(draft.outline);
  return {
    id,
    elevation,
    base: draft.base,
    outline: draft.outline,
    familyId: settings.familyId,
    pitch: pitchFor(settings.familyId, settings.pitch),
    // Gable and shed roofs need a rectangle.
    kind: isRectangle(draft.outline) ? settings.kind : 'hip',
    ridgeAxis: settings.ridge === 'auto' ? (w >= d ? 'x' : 'z') : settings.ridge,
    lowSide: settings.lowSide === 'auto' ? (w >= d ? '-z' : '-x') : settings.lowSide,
    overhang: { eave: settings.eave, gable: settings.gable },
    gableWalls: settings.gableWalls,
  };
};

export interface RoofPreview {
  /** At elevation 0: the 3D view lifts previews onto the current level. */
  roof: Roof;
  /** Why it can't be built (off the grid), or null. */
  problem: string | null;
  tiling: RoofTiling;
  /** The settings asked for a gable or shed roof over a shape that isn't a rectangle. */
  forcedHip: boolean;
}

export const roofPreviewAtom = atom<RoofPreview | null>((get) => {
  const draft = get(roofDraftAtom);
  if (!draft) return null;
  const settings = get(roofSettingsAtom);
  const roof = roofFromDraft(draft, settings, 'preview', 0);
  const problem = roofProblem(roof);
  return {
    roof,
    problem,
    tiling: problem ? { pieces: [], warnings: [] } : tileRoof(roof, getLibrary()),
    forcedHip: roof.kind !== settings.kind,
  };
});

/** "8 × 8 m · 26° gable · 33 pieces". */
export const roofPreviewLabel = ({ roof, problem, tiling }: RoofPreview): string => {
  const { w, d } = ringBox(roof.outline);
  const size = `${formatCompact(w)} × ${formatCompact(d)} m`;
  if (problem) return `${size} · ${problem}`;
  return `${size} · ${roof.pitch}° ${roof.kind} · ${tiling.pieces.length} pieces`;
};
