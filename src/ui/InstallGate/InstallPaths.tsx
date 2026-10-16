import { useState } from 'react';

import styles from './InstallGate.module.css';

const PLATFORMS = [
  {
    id: 'mac',
    label: 'macOS',
    path: '~/Library/Application Support/Steam/steamapps/common/Valheim',
  },
  {
    id: 'win',
    label: 'Windows',
    path: 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Valheim',
  },
  { id: 'linux', label: 'Linux', path: '~/.local/share/Steam/steamapps/common/Valheim' },
] as const;

const userPlatform = (): string => {
  const agent = navigator.userAgent;
  if (/Mac/.test(agent)) return 'mac';
  if (/Win/.test(agent)) return 'win';
  return 'linux';
};

/** Where Steam puts Valheim on each platform (this one first), with copy buttons. */
export const InstallPaths = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const mine = userPlatform();
  const platforms = [...PLATFORMS].sort((a, b) => Number(b.id === mine) - Number(a.id === mine));

  const copy = (id: string, path: string) => {
    void navigator.clipboard?.writeText(path).then(() => setCopied(id));
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Where Steam installs Valheim</h2>
      <ul className={styles.paths}>
        {platforms.map((p) => (
          <li key={p.id} className={styles.path}>
            <span className={styles.platform}>{p.label}</span>
            <code className={styles.code}>{p.path}</code>
            <button type="button" className={styles.copy} onClick={() => copy(p.id, p.path)}>
              {copied === p.id ? 'Copied' : 'Copy'}
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.note}>
        Other Steam libraries hold it under <code>steamapps/common/Valheim</code> too. Choose that
        folder; the planner finds the game data inside it (<code>Valheim.app</code> on macOS,{' '}
        <code>valheim_Data</code> on Windows and Linux).
      </p>
      {mine === 'mac' && (
        <p className={styles.note}>
          <code>~/Library</code> is hidden in the folder dialog: press <kbd>⌘</kbd>
          <kbd>⇧</kbd>
          <kbd>G</kbd> and paste the path, or drag the Valheim folder in from Finder.
        </p>
      )}
    </section>
  );
};
