import { atom, useAtom, useSetAtom } from 'jotai';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { keepFocus } from '../../controls/keepFocus';
import type { Library } from '../../catalog/library';
import { sameLevel } from '../../model/elevation';
import { levelOfItem } from '../../model/levels';
import type { SelectionItem } from '../../model/selection';
import type { Plan } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { getDerived, usePlan } from '../../store/planHooks';
import { selectionAtom } from '../../store/selection';
import { integrityShownAtom, useSupport } from '../../store/supportSync';
import { setWorkElevation } from '../../tools/levelActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './BomPanel.module.css';

/** Whether the Integrity list is open (session only). */
const integrityOpenAtom = atom<boolean>(true);

/** "Wood wall", "Wood floor", an item's name. */
const itemName = (plan: Plan, item: SelectionItem, lib: Library): string => {
  switch (item.kind) {
    case 'wall': {
      const id = plan.walls[item.id]?.familyId ?? '';
      return `${lib.wallFamilies.get(id)?.label ?? id} wall`;
    }
    case 'floor': {
      const id = plan.floors[item.id]?.familyId ?? '';
      return `${lib.floorFamilies.get(id)?.label ?? id} floor`;
    }
    case 'opening': {
      const prefab = plan.openings[item.id]?.prefab ?? '';
      return lib.openingDefs.get(prefab)?.label ?? prefab;
    }
    case 'prop': {
      const prefab = plan.props[item.id]?.prefab ?? '';
      return lib.propDefs.get(prefab)?.name ?? prefab;
    }
    case 'dimension':
      return 'Dimension';
    case 'roof': {
      const id = plan.roofs[item.id]?.familyId ?? '';
      return `${lib.roofFamilies.get(id)?.label ?? id} roof`;
    }
  }
};

/** What to do about a roof that would collapse, by what is likely wrong with it. */
const roofAdvice = (
  plan: Plan,
  item: SelectionItem,
  count: number,
  lib: Library
): string | null => {
  const roof = item.kind === 'roof' ? plan.roofs[item.id] : undefined;
  if (!roof) return null;
  if (lib.roofFamilies.get(roof.familyId)?.material === 'ashstone') {
    return 'Grausten needs stone under it: it breaks on wood.';
  }
  const { roofPieces, warnings } = getDerived(plan);
  const loose = warnings.some(
    (w) => w.source.kind === 'roof' && w.source.id === roof.id && /not resting/.test(w.message)
  );
  if (loose) return "Some of its edges don't rest on a wall: put walls under them.";
  const total = roofPieces.filter((p) => p.sourceId === roof.id).length;
  if (count >= total) {
    return 'Nothing holds it up: check its wall top in the Inspector, or Re-fit to room.';
  }
  return 'Too far from its walls for wood: add a ridge beam on poles (log beam + log poles) or shorten the span.';
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
        {lines.map(({ item, count }) => {
          const advice = roofAdvice(plan, item, count, getLibrary());
          return (
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
              {advice && <p className={styles.advice}>{advice}</p>}
            </li>
          );
        })}
      </ul>
    </details>
  );
};
