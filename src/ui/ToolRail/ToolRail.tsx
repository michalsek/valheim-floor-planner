import { keepFocus } from '../../controls/keepFocus';
import { useActiveToolId } from '../../store/hooks';
import { useToolContext } from '../../tools/toolContext';
import { setActiveTool, TOOLS } from '../../tools/toolbox';

import styles from './ToolRail.module.css';

export const ToolRail = () => {
  const ctx = useToolContext();
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
          onMouseDown={keepFocus}
          onClick={() => setActiveTool(ctx, id)}
        >
          <Icon />
        </button>
      ))}
    </nav>
  );
};
