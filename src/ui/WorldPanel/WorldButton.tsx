import { openWorldPanel } from '../../install/loadWorld';

import styles from '../StatusStrip/StatusStrip.module.css';

/** "World…" in the status strip: opens the world panel. */
export const WorldButton = () => (
  <button
    type="button"
    className={styles.installButton}
    title="Find your builds in a Valheim world save and import one (read-only)"
    onClick={openWorldPanel}
  >
    World…
  </button>
);
