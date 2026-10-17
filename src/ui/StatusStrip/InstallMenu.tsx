import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  clearAssetCache,
  extractAll,
  getAssetState,
  refreshAssetUsage,
  subscribeAssets,
} from '../../install/assetClient';
import { canPickDirectory } from '../../install/directory';
import {
  cancelScan,
  chooseFiles,
  chooseFolder,
  connectAssetFiles,
  dismissError,
  rescan,
  type InstallStatus,
} from '../../install/loadInstall';
import { ASSET_NOTE } from '../InstallGate/InstallGate';
import { ERROR_MESSAGES, formatScanDate, phaseLabel, PICKER_HINT } from '../shared/installCopy';
import { Row } from '../shared/PanelList';
import { useFolderDrop } from '../shared/useFolderDrop';
import { useFolderInput } from '../shared/useFolderInput';
import { useInstall } from '../shared/useInstall';

import styles from './StatusStrip.module.css';

const ScanStatus = ({ status }: { status: InstallStatus }) => {
  switch (status.kind) {
    case 'locating':
      return <p className={styles.menuNote}>Looking for the game data…</p>;
    case 'extracting':
      return (
        <p className={styles.menuNote} role="status">
          Storing the plan's models… {status.done}/{status.total || '…'}
        </p>
      );
    case 'parsing':
      return (
        <p className={styles.menuNote} role="status">
          {phaseLabel(status.phase)}… {status.objects.toLocaleString()} objects{' '}
          <button type="button" className={styles.menuLink} onClick={cancelScan}>
            Cancel
          </button>
        </p>
      );
    case 'error':
      return (
        <div className={styles.menuError} role="alert">
          <p>{ERROR_MESSAGES[status.code]}</p>
          {status.detail && <p className={styles.menuDetail}>{status.detail}</p>}
          <button type="button" className={styles.menuLink} onClick={dismissError}>
            Dismiss
          </button>
        </div>
      );
    default:
      return null;
  }
};

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Reconnects the stored folder if needed (inside the click), then extracts everything. */
const extractEverything = () =>
  void connectAssetFiles()
    .catch(() => false)
    .then(() => extractAll())
    .catch(() => {}); // Shown from the asset state.

/** The model cache: its size, "Extract all" with progress, and clearing it. */
const ModelCache = ({ busy }: { busy: boolean }) => {
  const { usage, progress, complete, memoryOnly, error } = useSyncExternalStore(
    subscribeAssets,
    getAssetState
  );
  useEffect(() => void refreshAssetUsage(), []);
  const size = usage === null ? '…' : formatMb(usage);
  return (
    <>
      <ul className={styles.menuList}>
        <Row label="Models" value={complete ? `${size} · all pieces` : `${size} cached`} />
      </ul>
      {progress && (
        <p className={styles.menuNote} role="status">
          Extracting models… {progress.done}/{progress.total || '…'}
        </p>
      )}
      {memoryOnly && (
        <p className={styles.menuNote}>
          This browser can't keep models (private mode, full storage or another tab), so they last
          for this visit only.
        </p>
      )}
      {error && !progress && (
        <div className={styles.menuError} role="alert">
          {error.code === 'permission' ? (
            // One message: the detail says the same.
            <p>Models are read from the game files: drop your Valheim folder on this menu.</p>
          ) : (
            <>
              <p>{ERROR_MESSAGES[error.code]}</p>
              {error.detail && <p className={styles.menuDetail}>{error.detail}</p>}
            </>
          )}
        </div>
      )}
      <div className={styles.menuActions}>
        {!complete && (
          <button
            type="button"
            className={styles.menuButton}
            disabled={busy || progress !== null}
            title="Read every piece's model and textures now (about 35 MB)"
            onClick={extractEverything}
          >
            Extract all models
          </button>
        )}
        <button
          type="button"
          className={styles.menuButton}
          disabled={progress !== null || !usage}
          title="Delete the models kept in this browser; they are read again when needed"
          onClick={() => void clearAssetCache()}
        >
          Clear cached models ({size})
        </button>
      </div>
      <p className={styles.menuNote}>{ASSET_NOTE}</p>
    </>
  );
};

/**
 * The loaded install in the status strip: piece count and Unity version, and a menu
 * with where it came from, Re-scan and Change folder (both reload the page), and the
 * model cache.
 */
export const InstallMenu = () => {
  const { status, loaded, hasHandle, pickerHint } = useInstall();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const folderInput = useFolderInput((files) => void chooseFiles(files));
  const { dragging, dropProps } = useFolderDrop();
  const busy =
    status.kind === 'locating' || status.kind === 'parsing' || status.kind === 'extracting';

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!loaded) return null;
  const changeFolder = () => (canPickDirectory() ? void chooseFolder() : folderInput.open());

  return (
    <div className={styles.install} ref={ref}>
      <button
        type="button"
        className={styles.installButton}
        aria-expanded={open}
        title="Game install"
        onClick={() => setOpen((o) => !o)}
      >
        {status.kind === 'parsing'
          ? `Scanning… ${status.objects.toLocaleString()} objects`
          : `${loaded.pieceCount} pieces · Unity ${loaded.unityVersion}`}
      </button>
      {open && (
        <div
          className={dragging ? `${styles.menu} ${styles.menuDragging}` : styles.menu}
          role="dialog"
          aria-label="Game install"
          {...dropProps}
        >
          <ul className={styles.menuList}>
            <Row label="Folder" value={loaded.folderName} />
            <Row label="Pieces" value={loaded.pieceCount} />
            <Row label="Unity" value={loaded.unityVersion} />
            <Row label="Build" value={loaded.buildGuid.slice(0, 8) || '—'} />
            <Row label="Scanned" value={formatScanDate(loaded)} />
          </ul>
          <ScanStatus status={status} />
          <div className={styles.menuActions}>
            {hasHandle && (
              <button
                type="button"
                className={styles.menuButton}
                disabled={busy}
                title="Read the game files again (after a game update)"
                onClick={() => void rescan()}
              >
                Re-scan
              </button>
            )}
            <button
              type="button"
              className={styles.menuButton}
              disabled={busy}
              title="Use another Valheim install"
              onClick={changeFolder}
            >
              Change folder…
            </button>
          </div>
          {pickerHint && <p className={styles.menuNote}>{PICKER_HINT}</p>}
          <ModelCache busy={busy} />
          <p className={styles.menuNote}>
            {dragging ? 'Drop to open this install' : 'Or drop a Valheim folder on this menu.'}
          </p>
        </div>
      )}
      {folderInput.input}
    </div>
  );
};
