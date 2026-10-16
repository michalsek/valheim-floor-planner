import { keepFocus } from '../../controls/keepFocus';
import type { UndoRedoState } from '../../store/planHooks';

import styles from './BomPanel.module.css';

interface PlanActionsProps {
  undoRedo: UndoRedoState;
  canClear: boolean;
  onClear(): void;
}

/** Undo, redo and clear, above the bill of materials. */
export const PlanActions = ({ undoRedo, canClear, onClear }: PlanActionsProps) => {
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
      <span className={styles.spacer} />
      <button
        type="button"
        className={styles.action}
        disabled={!canClear}
        title={canClear ? 'Remove every wall (undoable)' : 'The plan is empty'}
        onMouseDown={keepFocus}
        onClick={onClear}
      >
        Clear plan…
      </button>
    </header>
  );
};
