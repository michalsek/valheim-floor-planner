import { useAutosaveStatus } from '../../store/hooks';

import styles from './BomPanel.module.css';

const MESSAGES = {
  failed: 'Not saved: browser storage is full. Changes since then will be lost on reload.',
  unavailable: 'Autosave is off: this browser blocks site storage.',
} as const;

/** A persistent notice while the plan can't be autosaved. */
export const AutosaveNotice = () => {
  const status = useAutosaveStatus();
  if (status === 'ok') return null;
  return (
    <p className={styles.notice} role="status">
      {MESSAGES[status]}
    </p>
  );
};
