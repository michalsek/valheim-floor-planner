import { useStore } from 'jotai';

import { useActiveToolId } from '../../store/hooks';
import { setActiveTool, TOOLS } from '../../tools/toolbox';

import styles from './ToolRail.module.css';

export const ToolRail = () => {
  const store = useStore();
  const activeId = useActiveToolId();

  return (
    <nav className={styles.rail} aria-label="Tools">
      {TOOLS.map(({ id, label, shortcut, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={id === activeId ? `${styles.button} ${styles.active}` : styles.button}
          title={`${label} (${shortcut.toUpperCase()})`}
          aria-label={label}
          aria-pressed={id === activeId}
          // Never take focus: a focused button would be re-clicked by Space (pan).
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setActiveTool(store, id)}
        >
          <Icon />
        </button>
      ))}
    </nav>
  );
};
