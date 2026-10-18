import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  BUILD_CATEGORIES,
  BUILD_MATERIALS,
  CATEGORY_LABELS,
  MATERIAL_LABELS,
} from '../../catalog/buildPalette';
import type { PieceDef } from '../../catalog/pieceDefs';
import { keepFocus } from '../../controls/keepFocus';
import { addRecentAtom, buildRecentsAtom } from '../../store/buildRecents';
import { useActiveToolId } from '../../store/hooks';
import { getLibrary } from '../../store/libraryInstance';
import { armedPrefabAtom, armPrefabAtom } from '../../tools/Build/buildState';

import styles from './BuildPalette.module.css';
import {
  paletteMaterialAtom,
  paletteQueryAtom,
  paletteResults,
  paletteTabAtom,
  type PaletteTab,
} from './paletteState';
import { PieceTile } from './PieceTile';

const TABS: readonly { tab: PaletteTab; label: string }[] = [
  { tab: 'recent', label: 'Recent' },
  ...BUILD_CATEGORIES.map((c) => ({ tab: c, label: CATEGORY_LABELS[c] })),
];

interface TabsProps {
  /** Null while a search lists every category. */
  current: PaletteTab | null;
  onChange(tab: PaletteTab): void;
}

/** The hammer's categories, Recent first; arrow keys move between them when focused. */
const Tabs = ({ current, onChange }: TabsProps) => {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.tab === current);
    const next = TABS[(i + step + TABS.length) % TABS.length]!;
    onChange(next.tab);
    e.currentTarget.querySelector<HTMLElement>(`[data-tab="${next.tab}"]`)?.focus();
  };
  return (
    <div className={styles.tabs} role="tablist" aria-label="Categories" onKeyDown={onKeyDown}>
      {TABS.map(({ tab, label }) => (
        <button
          key={tab}
          type="button"
          role="tab"
          data-tab={tab}
          className={tab === current ? `${styles.tab} ${styles.tabOn}` : styles.tab}
          aria-selected={tab === current}
          tabIndex={tab === (current ?? 'recent') ? 0 : -1}
          onMouseDown={keepFocus}
          onClick={() => onChange(tab)}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

/**
 * Recent in the order it had when this view of the list (`view`: tab, search, chip)
 * opened, so arming a tile from it doesn't move the tiles; the new order shows the
 * next time the list is opened.
 */
const useStableRecents = (recents: readonly string[], view: string): readonly string[] => {
  const [shown, setShown] = useState({ view, recents });
  if (shown.view !== view) {
    setShown({ view, recents });
    return recents;
  }
  return shown.recents;
};

const countLabel = (n: number, searching: boolean) =>
  `${n} ${n === 1 ? 'piece' : 'pieces'}${searching ? ' in all categories' : ''}`;

/**
 * The Build tool's piece palette (M17 §2.4), beside the canvas while Build is active:
 * category tabs with Recent, material chips, a search over EN / PL names and prefabs,
 * and tiles (model thumbnails, glyphs meanwhile) that arm a piece. Enter arms the first
 * result; Esc clears the search, then leaves the box.
 */
export const BuildPalette = () => {
  const active = useActiveToolId() === 'build';
  const [query, setQuery] = useAtom(paletteQueryAtom);
  const [chosenTab, setTab] = useAtom(paletteTabAtom);
  const [material, setMaterial] = useAtom(paletteMaterialAtom);
  const recents = useAtomValue(buildRecentsAtom);
  const armed = useAtomValue(armedPrefabAtom);
  const armPrefab = useSetAtom(armPrefabAtom);
  const addRecent = useSetAtom(addRecentAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const lib = getLibrary();
  const tab = chosenTab ?? (recents.length > 0 ? 'recent' : 'building');
  const searching = query.trim() !== '';
  const shownRecents = useStableRecents(recents, `${active}|${tab}|${query}|${material}`);
  // The tiles follow a step behind (rendered in slices React can interrupt), so typing
  // never waits for hundreds of tiles.
  const filter = useDeferredValue(
    useMemo(() => ({ tab, query, material }), [tab, query, material])
  );
  const results = useMemo(
    () => paletteResults(lib.catalog.pieces, shownRecents, filter),
    [lib, shownRecents, filter]
  );

  const arm = useCallback(
    (prefab: string) => {
      armPrefab(prefab);
      addRecent(prefab);
      // The first piece armed would otherwise turn the default tab into Recent.
      if (chosenTab === null) setTab(tab);
      // Leave the search box, so R, Q/E and Esc reach the tool.
      inputRef.current?.blur();
    },
    [armPrefab, addRecent, chosenTab, setTab, tab]
  );

  if (!active) return null;

  // Enter takes the first result of what is typed now, not of the deferred list.
  const first = (): PieceDef | undefined =>
    paletteResults(lib.catalog.pieces, shownRecents, { tab, query, material })[0];
  return (
    <aside className={styles.palette} aria-label="Pieces">
      <input
        ref={inputRef}
        className={styles.search}
        type="search"
        placeholder="Search EN / PL / prefab"
        aria-label="Search pieces"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          const def = e.key === 'Enter' ? first() : undefined;
          if (def) arm(def.prefab);
          if (e.key === 'Escape') {
            e.preventDefault();
            if (query) setQuery('');
            else e.currentTarget.blur();
          }
        }}
      />
      <Tabs
        current={searching ? null : tab}
        onChange={(next) => {
          setTab(next);
          setQuery('');
        }}
      />
      <div className={styles.chips} role="group" aria-label="Material">
        {BUILD_MATERIALS.map((m) => (
          <button
            key={m}
            type="button"
            className={material === m ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            aria-pressed={material === m}
            onMouseDown={keepFocus}
            onClick={() => setMaterial(material === m ? null : m)}
          >
            {MATERIAL_LABELS[m]}
          </button>
        ))}
      </div>
      <p className={styles.count} aria-live="polite">
        {countLabel(results.length, filter.query.trim() !== '')}
      </p>
      {results.length === 0 ? (
        <div className={styles.empty}>
          {!searching && tab === 'recent' && material === null ? (
            <p>Pieces you pick show here.</p>
          ) : (
            <>
              <p>{searching ? `No pieces match “${query}”` : 'No pieces here'}</p>
              <button
                type="button"
                className={styles.clear}
                onMouseDown={keepFocus}
                onClick={() => {
                  setQuery('');
                  setMaterial(null);
                }}
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <ul className={styles.grid} role="list">
          {results.map((def) => (
            <PieceTile
              key={def.prefab}
              def={def}
              lib={lib}
              armed={def.prefab === armed}
              onArm={arm}
            />
          ))}
        </ul>
      )}
    </aside>
  );
};
