import { useAtom } from 'jotai';

import { revealSitesAtom } from '../../store/siteWorld';

import { REVEAL_TITLE } from './worldCopy';
import styles from './WorldPanel.module.css';

/** "Load revealed sites": whether extending the terrain brings in the sites it reaches. */
export const RevealToggle = () => {
  const [reveal, setReveal] = useAtom(revealSitesAtom);
  return (
    <label className={`${styles.terrainOption} ${styles.revealOption}`} title={REVEAL_TITLE}>
      <input
        type="checkbox"
        checked={reveal}
        onChange={(e) => setReveal(e.currentTarget.checked)}
      />{' '}
      Load revealed sites when extending the terrain
    </label>
  );
};
