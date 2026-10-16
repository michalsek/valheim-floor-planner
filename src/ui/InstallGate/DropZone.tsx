import { userPlatform } from '../../install/platform';

import { CopyButton } from './CopyButton';
import styles from './InstallGate.module.css';

const OPEN_IN_FINDER = 'open "$HOME/Library/Application Support/Steam/steamapps/common/Valheim"';

/**
 * The drop target's affordance (the whole gate page accepts the drop). On macOS this
 * is the dependable route (`lead`): Chrome's picker refuses `~/Library`, Finder doesn't.
 */
export const DropZone = ({ dragging, lead }: { dragging: boolean; lead: boolean }) => (
  <section
    className={[styles.dropZone, lead && styles.dropLead, dragging && styles.dropActive]
      .filter(Boolean)
      .join(' ')}
  >
    <p className={styles.dropTitle}>
      {dragging
        ? 'Drop to open it'
        : lead
          ? 'Drop your Valheim folder here'
          : 'Or drop your Valheim folder here'}
    </p>
    {userPlatform() === 'mac' ? (
      <>
        <p className={styles.note}>
          Drag the <code>Valheim</code> folder (or <code>Valheim.app</code>) from Finder onto this
          page. To open the folder in Finder, run this in Terminal:
        </p>
        <div className={styles.command}>
          <code className={styles.code}>{OPEN_IN_FINDER}</code>
          <CopyButton text={OPEN_IN_FINDER} />
        </div>
      </>
    ) : (
      <p className={styles.note}>
        Drag the <code>Valheim</code> folder from File Explorer or your file manager onto this page.
      </p>
    )}
  </section>
);
