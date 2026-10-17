/**
 * Valheim's `GetStableHashCode` (assembly_utils): two DJB-style accumulators over
 * alternating UTF-16 units, stopping at a NUL, combined as `h1 + h2 · 1566083941` in
 * int32 arithmetic. Prefabs and ZDO data keys are stored as these hashes
 * (research/README.md §7, "Piece identification").
 */
export const stableHash = (s: string): number => {
  let h1 = 5381;
  let h2 = 5381;
  for (let i = 0; i < s.length && s.charCodeAt(i) !== 0; i += 2) {
    h1 = (Math.imul(h1, 33) ^ s.charCodeAt(i)) | 0;
    if (i + 1 === s.length || s.charCodeAt(i + 1) === 0) break;
    h2 = (Math.imul(h2, 33) ^ s.charCodeAt(i + 1)) | 0;
  }
  return (h1 + Math.imul(h2, 1566083941)) | 0;
};
