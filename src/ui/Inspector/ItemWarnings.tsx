import type { SelectionItem } from '../../model/selection';
import { useDisplayDerived } from '../../store/planHooks';

import styles from './Inspector.module.css';

/** The plan warnings about one item. */
export const ItemWarnings = ({ item }: { item: SelectionItem }) => {
  const { warnings } = useDisplayDerived();
  const mine = warnings.filter((w) => w.source.kind === item.kind && w.source.id === item.id);
  if (mine.length === 0) return null;
  return (
    <ul className={styles.warnings}>
      {mine.map((w, i) => (
        <li key={i} className={styles.warning}>
          {w.message}
        </li>
      ))}
    </ul>
  );
};
