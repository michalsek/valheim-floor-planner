import { canPickDirectory } from '../../install/directory';
import type { InstallInfo } from '../../install/installStore';
import {
  cancelScan,
  chooseFiles,
  chooseFolder,
  dismissPickerHint,
  openCachedCatalogue,
  reconnect,
  type InstallStatus,
} from '../../install/loadInstall';
import { userPlatform } from '../../install/platform';

import { ERROR_MESSAGES, formatScanDate, PHASES, PICKER_HINT } from '../shared/installCopy';
import { useFolderDrop } from '../shared/useFolderDrop';
import { useFolderInput } from '../shared/useFolderInput';
import { useInstall } from '../shared/useInstall';

import { DropZone } from './DropZone';
import styles from './InstallGate.module.css';
import { InstallPaths } from './InstallPaths';

/** Where the 3D view's models come from (shown here and in the install menu). */
export const ASSET_NOTE =
  'Models and textures are read from your install and kept only in this browser (OPFS); nothing is uploaded.';

/** Where Chrome's picker can't open Steam's default folder, and what to do instead. */
const PICKER_LIMITS: Partial<Record<ReturnType<typeof userPlatform>, string>> = {
  mac: 'The folder dialog works only for Steam libraries outside ~/Library (e.g. on an external drive); Chrome refuses ~/Library as a system folder.',
  win: "Chrome refuses folders under Program Files (Steam's default); drag the folder onto this page instead.",
};

/** Folder pickers: the native one where it exists, the upload dialog always. */
const ChooseButtons = ({ primary }: { primary: boolean }) => {
  const folderInput = useFolderInput((files) => void chooseFiles(files));
  const native = canPickDirectory();
  const limit = native ? PICKER_LIMITS[userPlatform()] : undefined;
  return (
    <div className={styles.section}>
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
      {limit && <p className={styles.note}>{limit}</p>}
    </div>
  );
};

/** After the picker closed without a folder (possibly Chrome refusing it). */
const PickerHint = () => (
  <div className={styles.hint} role="status">
    <p>{PICKER_HINT}</p>
    <button type="button" className={styles.copy} onClick={dismissPickerHint}>
      Dismiss
    </button>
  </div>
);

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
        </div>
      );
    case 'error':
      return (
        <div className={styles.status}>
          <div className={styles.error} role="alert">
            <p>{ERROR_MESSAGES[status.code]}</p>
            {status.detail && <p className={styles.detail}>{status.detail}</p>}
          </div>
        </div>
      );
    case 'idle':
      return null;
  }
};

const CachedOption = ({ info }: { info: InstallInfo }) => (
  <section className={styles.section}>
    <button type="button" className={styles.primary} onClick={openCachedCatalogue}>
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
  const { status, cached, pickerHint } = useInstall();
  const busy = status.kind === 'locating' || status.kind === 'parsing';
  const { dragging, dropProps } = useFolderDrop();
  // On macOS Chrome can't open Steam's default folder, so dragging it in leads there.
  const dropFirst = userPlatform() === 'mac';
  const pickersPrimary = !dropFirst && !cached && status.kind !== 'needsPermission';

  return (
    <main
      className={dragging ? `${styles.gate} ${styles.gateDragging}` : styles.gate}
      {...dropProps}
    >
      <div className={styles.card}>
        <h1 className={styles.title}>Open your Valheim install</h1>
        <p className={styles.lead}>
          The planner reads every building piece, with its size, snap points and cost, straight from
          your copy of Valheim. The files are read here in your browser; nothing is uploaded.
        </p>
        <p className={styles.note}>{ASSET_NOTE}</p>
        <StatusPanel status={status} />
        {!busy && (
          <>
            {cached && <CachedOption info={cached} />}
            {dropFirst && <DropZone dragging={dragging} lead />}
            <ChooseButtons primary={pickersPrimary} />
            {pickerHint && <PickerHint />}
            {!dropFirst && <DropZone dragging={dragging} lead={false} />}
          </>
        )}
        <InstallPaths />
        <section className={styles.section}>
          <h2 className={styles.heading}>If the browser won't open the folder</h2>
          <p className={styles.note}>
            Chrome refuses folders it treats as system folders: all of <code>~/Library</code> on
            macOS, where Steam installs games, and Program Files on Windows. Dragging the folder
            onto this page works in every browser. “Select with upload dialog” reads the same files
            too: the browser calls it an upload and asks you to confirm about a thousand files, but
            nothing leaves your computer. Choose the Valheim folder itself, not the whole Steam
            library.
          </p>
        </section>
      </div>
    </main>
  );
};
