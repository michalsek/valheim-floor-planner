import { useAtom } from 'jotai';
import { useMemo, useRef } from 'react';

import { library, propDefs } from '../../catalog';
import { groupColor } from '../../catalog/groupColors';
import {
  filterProps,
  GROUP_LABELS,
  PROP_GROUPS,
  rectSize,
  type PropDef,
  type PropGroup,
} from '../../catalog/propDefs';
import { propRadius } from '../../catalog/stations';
import { keepFocus } from '../../controls/keepFocus';
import { ToggleButton } from '../../controls/ToggleButton';
import { formatSize } from '../../format';
import { useActiveToolId } from '../../store/hooks';
import { armedPrefabAtom, catalogGroupsAtom, catalogQueryAtom } from '../../tools/Prop/propState';

import styles from './CatalogBrowser.module.css';

const toggled = (set: ReadonlySet<PropGroup>, group: PropGroup): ReadonlySet<PropGroup> => {
  const next = new Set(set);
  if (!next.delete(group)) next.add(group);
  return next;
};

const CatalogRow = ({ def, armed, onArm }: { def: PropDef; armed: boolean; onArm(): void }) => {
  const size = rectSize(def.rect);
  const radius = propRadius(def.prefab, 0, library.catalog);
  return (
    <li>
      <button
        type="button"
        className={armed ? `${styles.row} ${styles.armed}` : styles.row}
        aria-pressed={armed}
        title={def.prefab}
        onMouseDown={keepFocus}
        onClick={onArm}
      >
        <span className={styles.swatch} style={{ background: groupColor(def.group) }} />
        <span className={styles.names}>
          <span className={styles.name}>{def.name}</span>
          {def.namePl !== def.name && <span className={styles.namePl}>{def.namePl}</span>}
        </span>
        <span className={styles.meta}>
          {def.approximate && (
            <span className={styles.warn} title="No collider in the game data: 1 × 1 m stand-in">
              ⚠
            </span>
          )}
          {radius && <span className={styles.badge}>r{radius.base}</span>}
          <span>{formatSize(size.x, size.z, 1)} m</span>
        </span>
      </button>
    </li>
  );
};

/**
 * The prop catalogue, shown beside the canvas while the Prop tool is active: search by
 * English or Polish name or prefab, filter by group, click an item to arm it. Enter
 * arms the first result; Esc clears the search, then leaves the box.
 */
export const CatalogBrowser = () => {
  const active = useActiveToolId() === 'prop';
  const [query, setQuery] = useAtom(catalogQueryAtom);
  const [groups, setGroups] = useAtom(catalogGroupsAtom);
  const [armed, setArmed] = useAtom(armedPrefabAtom);
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => filterProps(propDefs, query, groups), [query, groups]);
  if (!active) return null;

  const arm = (def: PropDef | undefined) => {
    if (!def) return;
    setArmed(def.prefab);
    // Leave the search box, so R and Esc reach the tool.
    inputRef.current?.blur();
  };

  return (
    <aside className={styles.browser} aria-label="Catalogue">
      <input
        ref={inputRef}
        className={styles.search}
        type="search"
        placeholder="Search EN / PL / prefab"
        aria-label="Search the catalogue"
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') arm(results[0]);
          if (e.key === 'Escape') {
            e.preventDefault();
            if (query) setQuery('');
            else e.currentTarget.blur();
          }
        }}
      />
      <div className={styles.chips}>
        {PROP_GROUPS.map((group) => (
          <ToggleButton
            key={group}
            variant="pill"
            pressed={groups.has(group)}
            onChange={() => setGroups((g) => toggled(g, group))}
          >
            {GROUP_LABELS[group]}
          </ToggleButton>
        ))}
      </div>
      <p className={styles.count}>
        {results.length} {results.length === 1 ? 'item' : 'items'}
      </p>
      {results.length === 0 ? (
        <div className={styles.empty}>
          <p>No items match “{query}”</p>
          <button
            type="button"
            className={styles.clear}
            onMouseDown={keepFocus}
            onClick={() => {
              setQuery('');
              setGroups(new Set());
            }}
          >
            Clear
          </button>
        </div>
      ) : (
        <ul className={styles.list}>
          {results.map((def) => (
            <CatalogRow
              key={def.prefab}
              def={def}
              armed={def.prefab === armed}
              onArm={() => arm(def)}
            />
          ))}
        </ul>
      )}
    </aside>
  );
};
