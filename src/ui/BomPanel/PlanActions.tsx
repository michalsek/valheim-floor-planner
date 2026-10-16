import { keepFocus } from '../../controls/keepFocus';
import type { UndoRedoState } from '../../store/planHooks';

import styles from './BomPanel.module.css';

/** Undo and redo, above the bill of materials; tooltips name the entry. */
export const PlanActions = ({ undoRedo }: { undoRedo: UndoRedoState }) => {
  const { undo, redo, canUndo, canRedo, undoLabel, redoLabel } = undoRedo;
  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.action}
        disabled={!canUndo}
        title={undoLabel ? `Undo ${undoLabel} (Ctrl/⌘Z)` : 'Nothing to undo'}
        onMouseDown={keepFocus}
        onClick={undo}
      >
        Undo
      </button>
      <button
        type="button"
        className={styles.action}
        disabled={!canRedo}
        title={redoLabel ? `Redo ${redoLabel} (Ctrl/⌘⇧Z)` : 'Nothing to redo'}
        onMouseDown={keepFocus}
        onClick={redo}
      >
        Redo
      </button>
    </header>
  );
};
