import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState } from 'react';

import { SegmentedControl } from '../../controls/SegmentedControl';
import { connectAssetFiles } from '../../install/loadInstall';
import { modelLoadAtom, modelRetryAtom, realLookAtom } from '../../store/modelView';

import styles from './StatusStrip.module.css';

const OPTIONS: readonly { value: 'boxes' | 'models'; label: string }[] = [
  { value: 'boxes', label: 'Boxes' },
  { value: 'models', label: 'Models' },
];

/** Asks for the game folder again (inside the click), then retries the waiting models. */
const Reconnect = ({ count }: { count: number }) => {
  const retry = useSetAtom(modelRetryAtom);
  const [failed, setFailed] = useState(false);
  const reconnect = () =>
    void connectAssetFiles()
      .catch(() => false)
      .then((ok) => {
        setFailed(!ok);
        if (ok) retry((n) => n + 1);
      });
  return (
    <button
      type="button"
      className={styles.menuLink}
      title={
        failed
          ? 'The folder could not be opened: open it again from the install menu'
          : 'Models are read from the game files: allow access to the Valheim folder again'
      }
      onClick={reconnect}
    >
      Reconnect folder to load {count} {count === 1 ? 'model' : 'models'}
    </button>
  );
};

/** Boxes or the real game models in 3D (persisted), with loading progress. */
export const ModelToggle = () => {
  const [realLook, setRealLook] = useAtom(realLookAtom);
  const load = useAtomValue(modelLoadAtom);
  const loading = load && load.done + load.blocked < load.total;
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
      {load && load.blocked > 0 && <Reconnect count={load.blocked} />}
    </div>
  );
};
