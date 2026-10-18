/**
 * Which world pieces a plan holds: each piece of a read world gets a key from its prefab
 * and its position to the centimetre (the save has no object ids: the game renumbers
 * them on load). The same save always gives the same keys, and a piece the player hasn't
 * touched keeps its key in a later save. Pure.
 */
import type { PieceCloud } from './pieceCloud';

/** FNV-1a over the UTF-16 units, from `seed`. */
const fnv = (s: string, seed: number): number => {
  let h = seed;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

/**
 * Piece `i`'s key: a 52-bit integer (exact as a JSON number), so a world of tens of
 * thousands of pieces has no two alike in practice.
 */
export const worldPieceKey = (cloud: PieceCloud, i: number): number => {
  const at = (k: number) => Math.round(cloud.position[i * 3 + k]! * 100);
  const text = `${cloud.prefabs[cloud.prefabIndex[i]!]}|${at(0)}|${at(1)}|${at(2)}`;
  return fnv(text, 0x811c9dc5) * 0x100000 + (fnv(text, 0x050c5d1f) >>> 12);
};

/** `keys` as a plan stores them: ascending, each once. */
export const sortedKeys = (keys: Iterable<number>): number[] =>
  [...new Set(keys)].sort((a, b) => a - b);
