import { canPickDirectory } from '../../install/directory';
import type { InstallInfo } from '../../install/installStore';
import {
  cancelScan,
  chooseFiles,
  chooseFolder,
  reconnect,
  openCachedCatalogue,
  type InstallStatus,
} from '../../install/loadInstall';

import { ERROR_MESSAGES, formatScanDate, PHASES } from '../shared/installCopy';
import { useFolderInput } from '../shared/useFolderInput';
import { useInstall } from '../shared/useInstall';

import styles from './InstallGate.module.css';
import { InstallPaths } from './InstallPaths';

/** Folder pickers: the native one where it exists, the upload dialog always. */
const ChooseButtons = ({ primary }: { primary: boolean }) => {
  const folderInput = useFolderInput((files) => void chooseFiles(files));
  const native = canPickDirectory();
  return (
    <div className={styles.actions}>
      {native && (
        <button
          type="button"
          className={primary ? styles.primary : styles.secondary}
          onClick={() => void chooseFolder()}
        >
          Choose Valheim folder…
        </button>
      )}
      <button
        type="button"
        className={primary && !native ? styles.primary : styles.secondary}
        onClick={folderInput.open}
      >
        {native ? 'Select with upload dialog…' : 'Choose Valheim folder…'}
      </button>
      {folderInput.input}
    </div>
  );
};

const Progress = ({ status }: { status: Extract<InstallStatus, { kind: 'parsing' }> }) => {
  const current = PHASES.findIndex((p) => p.phase === status.phase);
  return (
    <div className={styles.status} role="status">
      <ol className={styles.phases}>
        {PHASES.map((p, i) => (
          <li
            key={p.phase}
            className={i < current ? styles.done : i === current ? styles.current : styles.pending}
          >
            {p.label}
          </li>
        ))}
      </ol>
      <p className={styles.note}>{status.objects.toLocaleString()} objects read</p>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={cancelScan}>
          Cancel
        </button>
      </div>
    </div>
  );
};

const StatusPanel = ({ status }: { status: InstallStatus }) => {
  switch (status.kind) {
    case 'starting':
    case 'ready':
      return <p className={styles.status}>Checking for a saved install…</p>;
    case 'locating':
      return <p className={styles.status}>Looking for the game data…</p>;
    case 'parsing':
      return <Progress status={status} />;
    case 'needsPermission':
      return (
        <div className={styles.status}>
          <div className={styles.actions}>
            <button type="button" className={styles.primary} onClick={() => void reconnect()}>
              Reconnect to “{status.folderName}”
            </button>
          </div>
          <p className={styles.note}>
            The browser asks once per visit; choose “Allow on every visit” to skip this.
          </p>
          <ChooseButtons primary={false} />
        </div>
      );
    case 'error':
      return (
        <div className={styles.status}>
          <div className={styles.error} role="alert">
            <p>{ERROR_MESSAGES[status.code]}</p>
            {status.detail && <p className={styles.detail}>{status.detail}</p>}
          </div>
          <ChooseButtons primary />
        </div>
      );
    case 'idle':
      return (
        <div className={styles.status}>
          <ChooseButtons primary />
        </div>
      );
  }
};

const CachedOption = ({ info }: { info: InstallInfo }) => (
  <section className={styles.section}>
    <button type="button" className={styles.secondary} onClick={openCachedCatalogue}>
      Use the catalogue scanned on {formatScanDate(info)}
    </button>
    <p className={styles.note}>
      {info.pieceCount} pieces from “{info.folderName}” (Unity {info.unityVersion}), kept in this
      browser. It won't pick up game updates until you choose the folder again.
    </p>
  </section>
);

/**
 * Shown until a catalogue is loaded: the editor needs the user's own Valheim install,
 * since every piece's size, snap points and cost come from the game files.
 */
export const InstallGate = () => {
  const { status, cached } = useInstall();
  const busy = status.kind === 'locating' || status.kind === 'parsing';

  return (
    <main className={styles.gate}>
      <div className={styles.card}>
        <h1 className={styles.title}>Open your Valheim install</h1>
        <p className={styles.lead}>
          The planner reads every building piece, with its size, snap points and cost, straight from
          your copy of Valheim. The files are read here in your browser; nothing is uploaded.
        </p>
        <StatusPanel status={status} />
        {cached && !busy && <CachedOption info={cached} />}
        <InstallPaths />
        <section className={styles.section}>
          <h2 className={styles.heading}>If the browser won't open the folder</h2>
          <p className={styles.note}>
            Chrome refuses folders it treats as system folders, such as Program Files on Windows,
            and it may refuse <code>~/Library</code> on macOS. Use “Select with upload dialog”
            instead: it reads the same files. The browser calls it an upload and asks you to confirm
            about a thousand files; nothing leaves your computer. Choose the Valheim folder itself,
            not the whole Steam library, or listing the files takes much longer.
          </p>
        </section>
      </div>
    </main>
  );
};
