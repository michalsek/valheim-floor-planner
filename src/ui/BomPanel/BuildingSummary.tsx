import { formatArea } from '../../format';
import { useDerivedPlan } from '../../store/planHooks';

import styles from './BomPanel.module.css';

/** Room count and floor areas, at the top of the BOM panel once a room exists. */
export const BuildingSummary = () => {
  const { summary } = useDerivedPlan();
  if (summary.roomCount === 0) return null;
  const items = [
    ['Rooms', String(summary.roomCount)],
    ['Clear floor', formatArea(summary.clearArea)],
    ['Grid', formatArea(summary.gridArea)],
    ['Footprint', formatArea(summary.footprintArea)],
  ] as const;
  return (
    <section className={styles.summary} aria-label="Building summary">
      {items.map(([label, value]) => (
        <div key={label} className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{label}</span>
          <span className={styles.value}>{value}</span>
        </div>
      ))}
    </section>
  );
};
