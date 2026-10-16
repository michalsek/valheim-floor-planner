import { useActiveToolId } from '../../store/hooks';
import { getTool } from '../../tools/toolbox';

import styles from './ToolOptions.module.css';

/**
 * The active tool's settings, floating over the top of the canvas. It lives outside
 * `ToolHost`, so its pointer events never reach the tool.
 */
export const ToolOptionsBar = () => {
  const { Options, label } = getTool(useActiveToolId());
  if (!Options) return null;
  return (
    <div className={styles.bar} role="toolbar" aria-label={`${label} options`}>
      <span className={styles.title}>{label}</span>
      <Options />
    </div>
  );
};
