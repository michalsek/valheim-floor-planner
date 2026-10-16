import { keepFocus } from '../../controls/keepFocus';
import type { PlanStore } from '../../store/planStore';
import { useHistory } from '../../store/planHooks';
import { useToolContext } from '../../tools/toolContext';

import styles from './BomPanel.module.css';

/** How many entries the list shows (around the current one). */
const WINDOW = 20;

/** Undoes or redoes until the plan is as it was after entry `target` (0 = the start). */
const goTo = (plan: PlanStore, current: number, target: number): void => {
  for (let i = current; i > target; i--) plan.undo();
  for (let i = current; i < target; i++) plan.redo();
};

/**
 * The undo history, oldest first, with the current state marked. Clicking an entry
 * steps back (or forward) to just after it.
 */
export const HistoryList = () => {
  const { plan } = useToolContext();
  const { undo, redo, truncated } = useHistory();
  const entries = [truncated ? 'Earlier changes' : 'Start', ...undo, ...redo];
  const current = undo.length;
  const first = Math.max(0, Math.min(current - WINDOW / 2, entries.length - WINDOW));

  return (
    <details className={styles.history}>
      <summary className={styles.historySummary}>History ({undo.length + redo.length})</summary>
      <ol className={styles.historyList}>
        {entries.slice(first, first + WINDOW).map((label, i) => {
          const index = first + i;
          const state =
            index === current ? styles.historyCurrent : index > current ? styles.historyRedo : '';
          return (
            <li key={index}>
              <button
                type="button"
                className={`${styles.historyEntry} ${state}`}
                aria-current={index === current ? 'step' : undefined}
                onMouseDown={keepFocus}
                onClick={() => goTo(plan, current, index)}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ol>
    </details>
  );
};
