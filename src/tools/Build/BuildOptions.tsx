import { useAtomValue } from 'jotai';

import { formatCompact } from '../../format';
import { userPlatform } from '../../install/platform';

import { buildGhostAtom, buildRemovalAtom } from './buildGhost';
import { pieceName } from './buildLabel';
import { armedSetAtom, buildYawAtom, removeModeAtom } from './buildState';

/** The remove modifier as the keyboard labels it. */
const MOD = userPlatform() === 'mac' ? '⌘' : 'Ctrl';

const KEYS = `Wheel or R turn · Q/E snap point · Shift free · ${MOD}+click remove · Esc stop`;

/** The snap mode: free, auto or the manual point, and why nothing snaps when pieces hide. */
const SnapMode = () => {
  const ghost = useAtomValue(buildGhostAtom);
  if (!ghost) return null;
  const mode = ghost.free
    ? 'Free'
    : ghost.manual === null
      ? 'Auto snap'
      : `Snap point ${ghost.manual + 1} of ${ghost.snaps.length}`;
  const hiddenHint = !ghost.free && !ghost.pair && ghost.hidden;
  return (
    <>
      <span>{mode}</span>
      {hiddenHint && <span>Hidden pieces don't snap: try Up or All</span>}
    </>
  );
};

/**
 * The Build tool's bar: the armed piece, its turn and snap mode, and the keys; with
 * Ctrl/⌘ held, what a click would remove.
 */
export const BuildOptions = () => {
  const armed = useAtomValue(armedSetAtom);
  const yaw = useAtomValue(buildYawAtom);
  const removal = useAtomValue(buildRemovalAtom);
  const mod = useAtomValue(removeModeAtom);
  if (mod) {
    if (!removal) return <span>{MOD}+click a piece or item to remove it</span>;
    return removal.removable ? (
      <span>Click to remove {pieceName(removal.box.prefab)}</span>
    ) : (
      <span>Explode it to remove single pieces</span>
    );
  }
  if (!armed) return <span>Pick a piece in the palette · {MOD}+click removes</span>;
  const pieces = armed.pieces;
  return (
    <>
      <span>{pieces.length === 1 ? pieceName(pieces[0]!.prefab) : `${pieces.length} pieces`}</span>
      <span>{formatCompact(yaw)}°</span>
      <SnapMode />
      <span>{KEYS}</span>
    </>
  );
};
