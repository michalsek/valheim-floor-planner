import { atom, useAtom, useSetAtom } from 'jotai';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { keepFocus } from '../../controls/keepFocus';
import type { Library } from '../../catalog/library';
import { sameLevel } from '../../model/elevation';
import { levelOfItem } from '../../model/levels';
import type { SelectionItem } from '../../model/selection';
import type { Plan } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { usePlan } from '../../store/planHooks';
import { selectionAtom } from '../../store/selection';
import { integrityShownAtom, useSupport } from '../../store/supportSync';
import { setWorkElevation } from '../../tools/levelActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './BomPanel.module.css';

/** Whether the Integrity list is open (session only). */
const integrityOpenAtom = atom<boolean>(true);

/** An item's or piece's name. */
const itemName = (plan: Plan, item: SelectionItem, lib: Library): string => {
  switch (item.kind) {
    case 'prop': {
      const prefab = plan.props[item.id]?.prefab ?? '';
      return lib.propDefs.get(prefab)?.name ?? prefab;
    }
    case 'dimension':
      return 'Dimension';
    case 'raw': {
      const prefab = plan.rawPieces[item.id]?.prefab ?? '';
      return lib.catalog.pieces.get(prefab)?.name ?? prefab;
    }
  }
};

/** Whether `ref`'s element is on screen (inside the scrolled panel too). */
const useOnScreen = (ref: RefObject<Element | null>): boolean => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
};

/**
 * Integrity: the items with pieces that would collapse (on `level`, or everywhere for
 * null); clicking one selects it and goes to its level. Support is only worked out
 * while this is open and on screen (or the support view is on), after the plan settles.
 */
export const IntegrityList = ({ level }: { level: number | null }) => {
  const ctx = useToolContext();
  const plan = usePlan();
  const select = useSetAtom(selectionAtom);
  const [open, setOpen] = useAtom(integrityOpenAtom);
  const ref = useRef<HTMLDetailsElement>(null);
  const visible = useOnScreen(ref);
  const setShown = useSetAtom(integrityShownAtom);
  const { support, fresh } = useSupport();

  useEffect(() => {
    setShown(open && visible);
    return () => setShown(false);
  }, [open, visible, setShown]);

  const lines = (support?.collapsing ?? []).filter(
    ({ item }) => level === null || sameLevel(levelOfItem(plan, item, getLibrary()) ?? NaN, level)
  );
  const total = lines.reduce((n, l) => n + l.count, 0);
  const status = !support || !fresh ? 'checking…' : total === 0 ? 'all held up' : null;
  return (
    <details
      ref={ref}
      className={styles.integrity}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className={styles.integrityTitle}>
        Integrity {status && <span className={styles.checking}>{status}</span>}
      </summary>
      <ul className={styles.integrityList}>
        {total > 0 && (
          <li className={styles.warning}>
            {total} {total === 1 ? 'piece' : 'pieces'} would collapse
          </li>
        )}
        {lines.map(({ item, count }) => (
          <li key={`${item.kind}:${item.id}`}>
            <button
              type="button"
              className={styles.collapse}
              title="Select it, on its level"
              onMouseDown={keepFocus}
              onClick={() => {
                const elevation = levelOfItem(plan, item, getLibrary());
                if (elevation !== null) setWorkElevation(ctx, elevation);
                select([item]);
              }}
            >
              <span>{itemName(plan, item, getLibrary())}</span>
              <span className={styles.value}>{count}</span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
};
