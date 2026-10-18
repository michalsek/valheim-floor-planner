import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';

import { canPickDirectory } from '../../install/directory';
import { captureDrop } from '../../install/dropFolder';
import {
  backToStart,
  chooseWorldDrop,
  chooseWorldFiles,
  chooseWorldFolder,
  closeWorldPanel,
  forgetWorld,
  getWorldState,
  openCachedWorld,
  openCandidate,
  subscribeWorld,
  type WorldStatus,
} from '../../install/loadWorld';
import type { CachedWorld } from '../../install/worldCache';
import { useFileDrop } from '../shared/useFileDrop';
import { useFolderInput } from '../shared/useFolderInput';

import { AddTerrainHint } from './AddTerrain';
import { WorldOverview } from './WorldOverview';
import {
  WORLD_DRAG_HINT,
  WORLD_INTRO,
  WORLD_PLACES,
  WORLD_PRIVACY,
  worldErrorMessage,
} from './worldCopy';
import styles from './WorldPanel.module.css';

export const useWorld = () => useSyncExternalStore(subscribeWorld, getWorldState);

const RecentWorlds = ({ recent }: { recent: readonly CachedWorld[] }) =>
  recent.length === 0 ? null : (
    <section className={styles.section}>
      <h3 className={styles.heading}>Read before</h3>
      <ul className={styles.list}>
        {recent.map((world) => (
          <li key={world.key} className={styles.listRow}>
            <span>
              <strong>{world.name}</strong>{' '}
              <span className={styles.muted}>
                {world.folder !== world.name && `in ${world.folder} · `}
                {world.generation !== null && `save ${world.generation} · `}
                {world.pieces.toLocaleString('en-GB')} pieces
              </span>
            </span>
            <span className={styles.rowActions}>
              <button
                type="button"
                className={styles.button}
                onClick={() => void openCachedWorld(world)}
              >
                Open
              </button>
              <button
                type="button"
                className={styles.linkButton}
                title="Delete the kept piece list from this browser (the save is untouched)"
                onClick={() => void forgetWorld(world.key)}
              >
                Forget
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );

/** Where worlds are, how to bring one in, and the worlds read before. */
const Start = ({ recent }: { recent: readonly CachedWorld[] }) => {
  const folderInput = useFolderInput((files) => void chooseWorldFiles(files));
  const choose = () => (canPickDirectory() ? void chooseWorldFolder() : folderInput.open());
  return (
    <>
      <p className={styles.text}>{WORLD_INTRO}</p>
      <AddTerrainHint />
      <div className={styles.dropZone}>
        <p>Drop a world folder here</p>
        <button type="button" className={styles.button} onClick={choose}>
          Choose folder…
        </button>
      </div>
      <section className={styles.section}>
        <h3 className={styles.heading}>Where the worlds are (macOS)</h3>
        <dl className={styles.places}>
          {WORLD_PLACES.map(({ label, path }) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <code>{path}</code>
              </dd>
            </div>
          ))}
        </dl>
        <p className={styles.note}>{WORLD_DRAG_HINT}</p>
      </section>
      <RecentWorlds recent={recent} />
      <p className={styles.note}>{WORLD_PRIVACY}</p>
      {folderInput.input}
    </>
  );
};

const Body = ({ status, recent }: { status: WorldStatus; recent: readonly CachedWorld[] }) => {
  switch (status.kind) {
    case 'start':
      return <Start recent={recent} />;
    case 'listing':
      return <p className={styles.text}>Looking for worlds…</p>;
    case 'choosing':
      return (
        <section className={styles.section}>
          <h3 className={styles.heading}>Which world?</h3>
          <ul className={styles.list}>
            {status.candidates.map((candidate) => (
              <li key={`${candidate.kind}:${candidate.name}`} className={styles.listRow}>
                <span>
                  <strong>{candidate.name}</strong>
                  {candidate.kind === 'db' && <span className={styles.muted}> · old .db save</span>}
                </span>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => void openCandidate(candidate)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </section>
      );
    case 'scanning':
      return (
        <p className={styles.text} role="status">
          Reading {status.name}…{' '}
          {status.total > 0 && `${Math.round((status.done / status.total) * 100)}%`}
        </p>
      );
    case 'ready':
      return <WorldOverview world={status.world} />;
    case 'error':
      return (
        <div className={styles.error} role="alert">
          <p>{worldErrorMessage(status.code)}</p>
          {status.detail && <p className={styles.muted}>{status.detail}</p>}
          <button type="button" className={styles.button} onClick={backToStart}>
            Back
          </button>
        </div>
      );
  }
};

/**
 * While the panel is open the plan's shortcuts are off: keys aimed outside it are
 * stopped before anything sees them (Esc closes it), and keys inside it stop at the
 * dialog (`onKeyDown`), short of the tools' window listener.
 */
const useModalKeys = (open: boolean, dialog: RefObject<HTMLDivElement | null>) => {
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const stop = (event: KeyboardEvent) => {
      if (dialog.current?.contains(event.target as Node)) return;
      event.stopImmediatePropagation();
      if (event.type === 'keydown' && event.key === 'Escape') closeWorldPanel();
    };
    window.addEventListener('keydown', stop, true);
    window.addEventListener('keyup', stop, true);
    return () => {
      window.removeEventListener('keydown', stop, true);
      window.removeEventListener('keyup', stop, true);
    };
  }, [open, dialog]);
};

const keepKeysInside = (event: ReactKeyboardEvent<HTMLDivElement>) => {
  event.stopPropagation();
  if (event.key === 'Escape') closeWorldPanel();
};

/**
 * The world panel, modal: open a save (drop or pick its folder), see its builds, import
 * one. Takes drops anywhere on it; Esc closes it.
 */
export const WorldPanel = () => {
  const { open, status, recent } = useWorld();
  const dialog = useRef<HTMLDivElement>(null);
  const { dragging, dropProps } = useFileDrop((data) => {
    const drop = captureDrop(data, false);
    if (drop) void chooseWorldDrop(drop);
  });
  useModalKeys(open, dialog);

  if (!open) return null;
  const busy = status.kind === 'listing' || status.kind === 'scanning';
  return (
    // The backdrop takes drops too: a folder dropped beside the panel would otherwise
    // be opened by the browser.
    <div
      className={styles.backdrop}
      onPointerDown={(e) => e.target === e.currentTarget && closeWorldPanel()}
      {...dropProps}
    >
      <div
        className={dragging ? `${styles.panel} ${styles.dragging}` : styles.panel}
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="World"
        tabIndex={-1}
        onKeyDown={keepKeysInside}
        onKeyUp={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>
            {status.kind === 'ready' ? status.world.name : 'Import from a world'}
          </h2>
          {status.kind !== 'start' && !busy && (
            <button type="button" className={styles.linkButton} onClick={backToStart}>
              Another world…
            </button>
          )}
          <button
            type="button"
            className={styles.close}
            title="Close (Esc)"
            aria-label="Close"
            onClick={closeWorldPanel}
          >
            ×
          </button>
        </header>
        <div className={styles.body}>
          <Body status={status} recent={recent} />
        </div>
        {dragging && <div className={styles.dropHint}>Drop to open this world</div>}
      </div>
    </div>
  );
};
