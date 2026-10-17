import { useAtom, useAtomValue } from 'jotai';
import { useState, useSyncExternalStore } from 'react';

import { SegmentedControl } from '../../controls/SegmentedControl';
import { getAssetState, subscribeAssets } from '../../install/assetClient';
import { connectAssetFiles } from '../../install/loadInstall';
import { memoryNoticeDismissedAtom, modelLoadAtom, realLookAtom } from '../../store/modelView';
import { useInstall } from '../shared/useInstall';

import styles from './StatusStrip.module.css';

const OPTIONS: readonly { value: 'boxes' | 'models'; label: string }[] = [
  { value: 'boxes', label: 'Boxes' },
  { value: 'models', label: 'Models' },
];

const plural = (count: number) => `${count} ${count === 1 ? 'model' : 'models'}`;

/** Shown when models need the game files and they aren't at hand. */
export const DROP_TO_LOAD = 'Drop your Valheim folder here to load models';

/**
 * Asks for the stored game folder again (inside the click); the waiting models are
 * asked for again once it is back. A failure falls back to the drop hint.
 */
const Reconnect = ({ count }: { count: number }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className={styles.modelNote}>{DROP_TO_LOAD}</span>;
  const reconnect = () =>
    void connectAssetFiles()
      .catch(() => false)
      .then((ok) => setFailed(!ok));
  return (
    <button
      type="button"
      className={styles.menuLink}
      title="Models are read from the game files: allow access to the Valheim folder again"
      onClick={reconnect}
    >
      Reconnect folder to load {plural(count)}
    </button>
  );
};

/** Once per visit: models aren't kept by this browser. */
const MemoryNotice = () => {
  const { memoryOnly } = useSyncExternalStore(subscribeAssets, getAssetState);
  const [dismissed, setDismissed] = useAtom(memoryNoticeDismissedAtom);
  if (!memoryOnly || dismissed) return null;
  return (
    <span className={styles.modelNote} role="status">
      Models last for this visit only: this browser can't keep them{' '}
      <button
        type="button"
        className={styles.menuLink}
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      >
        OK
      </button>
    </span>
  );
};

/** Boxes or the real game models in 3D (persisted), with loading progress and problems. */
export const ModelToggle = () => {
  const [realLook, setRealLook] = useAtom(realLookAtom);
  const load = useAtomValue(modelLoadAtom);
  const { hasHandle } = useInstall();
  const loading = load && load.done + load.blocked + load.failed < load.total;
  return (
    <div className={styles.picker} title="Draw pieces as boxes or as the game's models">
      <SegmentedControl
        label="Pieces"
        options={OPTIONS}
        value={realLook ? 'models' : 'boxes'}
        onChange={(value) => setRealLook(value === 'models')}
      />
      {loading && (
        <span role="status">
          Loading models {load.done}/{load.total}
        </span>
      )}
      {load &&
        load.blocked > 0 &&
        (hasHandle ? (
          <Reconnect count={load.blocked} />
        ) : (
          <span className={styles.modelNote} role="status">
            {DROP_TO_LOAD}
          </span>
        ))}
      {load && load.failed > 0 && (
        <span
          className={styles.modelError}
          role="alert"
          title={`These pieces are drawn as boxes. ${load.failure ?? ''}`.trim()}
        >
          {plural(load.failed)} couldn't be read
        </span>
      )}
      {realLook && <MemoryNotice />}
    </div>
  );
};
