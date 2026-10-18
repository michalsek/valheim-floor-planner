import { useAutosaveStatus } from '../../store/hooks';

import styles from './BomPanel.module.css';

const MESSAGES = {
  failed: 'Not saved: browser storage is full. Changes since then will be lost on reload.',
  unavailable: 'Autosave is off: this browser blocks site storage.',
  unread:
    'Autosave is off: the saved plan couldn’t be read, so it is left as it was. Reload to try again.',
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
