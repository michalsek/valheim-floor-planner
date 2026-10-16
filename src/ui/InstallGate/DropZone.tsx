import { CopyButton } from './CopyButton';
import styles from './InstallGate.module.css';
import { userPlatform } from './InstallPaths';

const OPEN_IN_FINDER = 'open "$HOME/Library/Application Support/Steam/steamapps/common/Valheim"';

/**
 * The drop target's affordance (the whole gate page accepts the drop). On macOS this
 * is the dependable route: the folder dialog hides `~/Library`, but Finder doesn't.
 */
export const DropZone = ({ dragging }: { dragging: boolean }) => (
  <section className={dragging ? `${styles.dropZone} ${styles.dropActive}` : styles.dropZone}>
    <p className={styles.dropTitle}>
      {dragging ? 'Drop to open it' : 'Or drop your Valheim folder here'}
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
