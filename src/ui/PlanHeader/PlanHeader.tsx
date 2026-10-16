import { useAtom } from 'jotai';
import { useRef, useState } from 'react';

import { Button } from '../../controls/Button';
import { keepFocus } from '../../controls/keepFocus';
import type { Plan } from '../../model/types';
import {
  fileStatusAtom,
  openPlanFile,
  saveCurrentPlan,
  startNewPlan,
} from '../../store/fileActions';
import { usePlanSelector } from '../../store/planHooks';
import { useToolContext } from '../../tools/toolContext';

import styles from './PlanHeader.module.css';

const nameOf = (plan: Plan) => plan.name;

/** The plan name; commits on Enter or blur, Esc reverts. */
const PlanNameInput = ({ name, onRename }: { name: string; onRename(name: string): void }) => {
  const [draft, setDraft] = useState(name);
  const reverting = useRef(false);

  const commit = () => {
    const next = draft.trim();
    if (!reverting.current && next && next !== name) {
      onRename(next);
    } else {
      setDraft(name);
    }
    reverting.current = false;
  };

  return (
    <input
      className={styles.name}
      aria-label="Plan name"
      value={draft}
      maxLength={120}
      onChange={(e) => setDraft(e.currentTarget.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') reverting.current = true;
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
    />
  );
};

const FileStatusLine = () => {
  const [status, setStatus] = useAtom(fileStatusAtom);
  if (!status) return null;
  return (
    <p className={status.tone === 'error' ? styles.error : styles.info} role="status">
      <span>{status.message}</span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss"
        onMouseDown={keepFocus}
        onClick={() => setStatus(null)}
      >
        ×
      </button>
    </p>
  );
};

/** The plan's name and its file actions: New, Open and Save. */
export const PlanHeader = () => {
  const ctx = useToolContext();
  const name = usePlanSelector(nameOf);

  return (
    <header className={styles.header}>
      {/* Keyed by the name, so an undone rename shows in the field. */}
      <PlanNameInput
        key={name}
        name={name}
        onRename={(next) => ctx.plan.dispatch({ type: 'plan.rename', name: next })}
      />
      <div className={styles.actions}>
        <Button title="Start an empty plan (undoable)" onClick={() => startNewPlan(ctx)}>
          New…
        </Button>
        <Button title="Open a plan file (Ctrl/⌘O)" onClick={() => void openPlanFile(ctx)}>
          Open…
        </Button>
        <Button title="Save the plan to a file (Ctrl/⌘S)" onClick={() => void saveCurrentPlan(ctx)}>
          Save
        </Button>
      </div>
      <FileStatusLine />
    </header>
  );
};
