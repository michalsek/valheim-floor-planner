/**
 * The Build tool's state (M17 §2): what is armed, its turn and the manual snap point.
 * The ghost itself is derived in `buildGhost.ts`.
 */
import { atom } from 'jotai';

import { type GhostSet, singlePiece } from '../../model/build/ghostSet';
import { modifiersAtom } from '../../store/session';

/** How many recently armed prefabs keep their ghost meshes (and models) loaded. */
export const GHOST_KEPT = 8;

const armedSetBase = atom<GhostSet | null>(null);

/** The manual snap point (Q/E), as an index into the set's snap points; null is auto. */
export const manualSnapAtom = atom<number | null>(null);

/**
 * While copies of a selection are armed (Select's Mod+D): the turn to give back when they
 * are disarmed or replaced; null otherwise.
 */
const carryYawBase = atom<number | null>(null);

/** The armed set is copies of a selection: Esc goes back to Select. */
export const carriedCopiesAtom = atom((get) => get(carryYawBase) !== null);

/**
 * Ctrl/⌘ is ignored until it is pressed again (it was still down from the Mod+D that
 * carried copies in, and would otherwise turn every click into a removal).
 */
export const modIgnoredAtom = atom<boolean>(false);

/** Ctrl/⌘ + click removes: the modifier is held, and not left over from Mod+D. */
export const removeModeAtom = atom((get) => get(modifiersAtom).mod && !get(modIgnoredAtom));

/** The prefabs armed last, newest first (at most `GHOST_KEPT`). */
export const keptPrefabsAtom = atom<readonly string[]>([]);

/**
 * What the Build tool carries (null: nothing armed). Arming a new set goes back to auto
 * snapping, as the game does; the turn is kept.
 */
export const armedSetAtom = atom(
  (get) => get(armedSetBase),
  (get, set, next: GhostSet | null) => {
    set(armedSetBase, next);
    set(manualSnapAtom, null);
    const carryYaw = get(carryYawBase);
    if (carryYaw !== null) {
      set(buildYawAtom, carryYaw);
      set(carryYawBase, null);
    }
    if (!next) return;
    const prefabs = [...new Set(next.pieces.map((p) => p.prefab))];
    const kept = get(keptPrefabsAtom);
    if (prefabs.every((p, i) => kept[i] === p)) return;
    const rest = kept.filter((p) => !prefabs.includes(p));
    set(keptPrefabsAtom, [...prefabs, ...rest].slice(0, Math.max(GHOST_KEPT, prefabs.length)));
  }
);

/** Arms one piece of `prefab` (null disarms). */
export const armPrefabAtom = atom(null, (_get, set, prefab: string | null) => {
  set(armedSetAtom, prefab === null ? null : singlePiece(prefab));
});

/** The armed prefab when one piece is armed (the palette's highlight). */
export const armedPrefabAtom = atom<string | null>((get) => {
  const armed = get(armedSetAtom);
  return armed?.pieces.length === 1 ? armed.pieces[0]!.prefab : null;
});

/** The ghost's turn in degrees (clockwise, multiples of 22.5°), kept across armed pieces. */
export const buildYawAtom = atom<number>(0);

/**
 * Arms copies of a selection turned as it is (`yaw`, its first piece's): the Build turn
 * comes back when they are disarmed; Ctrl/⌘, still down from Mod+D, is ignored.
 */
export const armCopiesAtom = atom(null, (get, set, copies: GhostSet, yaw: number) => {
  set(armedSetAtom, copies);
  set(carryYawBase, get(buildYawAtom));
  set(buildYawAtom, yaw);
  set(modIgnoredAtom, get(modifiersAtom).mod);
});
