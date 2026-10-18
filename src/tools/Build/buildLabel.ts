/**
 * The Build label's lines (M17 §2.5), shared by the 3D and 2D previews: "Wood wall ·
 * 72 / 100 · snap 2/4", then (warnings) "Already placed here", "Would collapse" or
 * "Overlaps Wood beam by 0.6 m". With Ctrl/⌘ held, what a click would remove.
 */
import { getLibrary } from '../../store/libraryInstance';

import type { BuildGhost, BuildRemoval } from './buildGhost';

export interface LabelLine {
  text: string;
  warn: boolean;
}

/** A prefab's name for labels and history entries. */
export const pieceName = (prefab: string | null): string =>
  prefab === null ? 'piece' : (getLibrary().catalog.pieces.get(prefab)?.name ?? prefab);

const oneDecimal = (n: number): string => String(Math.round(n * 10) / 10);

/** The weakest piece's support as "value / maximum"; null when none takes part. */
const supportText = (ghost: BuildGhost): string | null => {
  if (!ghost.support) return 'checking…';
  let weakest: number | null = null;
  ghost.support.forEach((support, i) => {
    if (support.state === 'none') return;
    if (weakest === null || support.value < ghost.support![weakest]!.value) weakest = i;
  });
  if (weakest === null) return null;
  const value = oneDecimal(ghost.support[weakest]!.value);
  const material = ghost.boxes[weakest]!.material;
  const max = material ? getLibrary().catalog.materialSupport[material]?.maxSupport : undefined;
  return max === undefined ? value : `${value} / ${oneDecimal(max)}`;
};

const snapText = (ghost: BuildGhost): string | null => {
  if (ghost.free) return 'free';
  if (ghost.snaps.length === 0) return null;
  return ghost.manual === null ? 'snap auto' : `snap ${ghost.manual + 1}/${ghost.snaps.length}`;
};

/** The ghost's label: what, its support and snap mode, then what is wrong. */
export const ghostLabel = (ghost: BuildGhost): LabelLine[] => {
  const pieces = ghost.set.pieces;
  const name = pieces.length === 1 ? pieceName(pieces[0]!.prefab) : `${pieces.length} pieces`;
  const head = [name, supportText(ghost), snapText(ghost)].filter((t) => t !== null).join(' · ');
  const lines: LabelLine[] = [{ text: head, warn: false }];
  if (ghost.blockedBy) lines.push({ text: 'Already placed here', warn: true });
  if (ghost.support?.some((s) => s.state === 'collapsing')) {
    lines.push({ text: 'Would collapse', warn: true });
  }
  if (ghost.overlap && !ghost.blockedBy) {
    const { box, depth } = ghost.overlap;
    lines.push({ text: `Overlaps ${pieceName(box.prefab)} by ${oneDecimal(depth)} m`, warn: true });
  }
  return lines;
};

/** What Ctrl/⌘ + click would do to the piece under the pointer. */
export const removalLabel = ({ box, removable }: BuildRemoval): LabelLine =>
  removable
    ? { text: `Remove ${pieceName(box.prefab)}`, warn: false }
    : { text: 'Explode it to remove single pieces', warn: true };
