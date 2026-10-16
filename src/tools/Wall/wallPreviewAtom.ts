import { atom } from 'jotai';

import type { WallFamily } from '../../catalog/wallFamilies';
import { splitWall } from '../../model/splitWall';
import type { PlacedPiece, Vec2, WallRun } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { cursorAtom } from '../../store/session';

import { draftToRun, nextDraftAction, type DraftPoints } from './wallDraft';
import { wallDraftAtom, wallSettingsAtom } from './wallState';

export interface WallPreviewState {
  /** The clicked vertices. */
  points: DraftPoints;
  /** The segment from the last vertex to where a click would land. */
  liveSegment: { a: Vec2; b: Vec2 } | null;
  /** A click now would close the loop. */
  canClose: boolean;
  family: WallFamily | undefined;
  /** The run a click would commit (closing loops already oriented clockwise). */
  run: WallRun | null;
  pieces: PlacedPiece[];
}

/**
 * What the wall being drawn would become if the user clicked now. Derived from the
 * draft, the cursor and the settings, so it follows pans, zooms and setting changes.
 */
export const wallPreviewAtom = atom<WallPreviewState | null>((get) => {
  const draft = get(wallDraftAtom);
  if (!draft) return null;
  const cursor = get(cursorAtom);
  const settings = get(wallSettingsAtom);
  const family = getLibrary().wallFamilies.get(settings.familyId);

  const action = cursor ? nextDraftAction(draft.points, cursor.snapped) : null;
  const first = draft.points[0];
  const last = draft.points[draft.points.length - 1] ?? first;
  const points = action?.kind === 'add' ? [...draft.points, action.p] : draft.points;
  const canClose = action?.kind === 'close';
  const run = draftToRun('preview', points, canClose, settings);

  return {
    points: draft.points,
    liveSegment:
      action?.kind === 'add' ? { a: last, b: action.p } : canClose ? { a: last, b: first } : null,
    canClose,
    family,
    run,
    pieces: run && family ? splitWall(run, family).pieces : [],
  };
});
