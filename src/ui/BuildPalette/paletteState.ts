/**
 * The Build palette's filters, kept for the session (so leaving Build and coming back
 * shows the same tab) and what they list.
 */
import { atom } from 'jotai';

import { filterPieces, type BuildCategory, type BuildMaterial } from '../../catalog/buildPalette';
import type { PieceDef } from '../../catalog/pieceDefs';
import { normalizeSearch } from '../../catalog/propDefs';

export type PaletteTab = 'recent' | BuildCategory;

/** Null until the user picks one: Recent when it has pieces, else Building. */
export const paletteTabAtom = atom<PaletteTab | null>(null);
export const paletteQueryAtom = atom('');
/** The material chip that is on (null: any material). */
export const paletteMaterialAtom = atom<BuildMaterial | null>(null);

export interface PaletteFilter {
  tab: PaletteTab;
  query: string;
  material: BuildMaterial | null;
}

/**
 * What the palette lists: with a query, matches from every category (Recent included),
 * exact names first; otherwise the tab's pieces, Recent in the order they were armed.
 */
export const paletteResults = (
  pieces: ReadonlyMap<string, PieceDef>,
  recents: readonly string[],
  { tab, query, material }: PaletteFilter
): PieceDef[] => {
  if (query.trim() !== '') {
    // "wood wall" puts Wood Wall before Wood Wall 1x1.
    const q = normalizeSearch(query).trim();
    const found = filterPieces(pieces.values(), query, null, material);
    const exact = (def: PieceDef) =>
      normalizeSearch(def.name) === q || normalizeSearch(def.prefab) === q;
    return [...found.filter(exact), ...found.filter((def) => !exact(def))];
  }
  if (tab !== 'recent') return filterPieces(pieces.values(), '', tab, material);
  const recent = recents.flatMap((prefab) => {
    const def = pieces.get(prefab);
    return def ? [def] : [];
  });
  return filterPieces(recent, '', null, material);
};
