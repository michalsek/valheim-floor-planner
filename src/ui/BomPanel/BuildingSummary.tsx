import { formatArea } from '../../format';
import { useDerivedPlan } from '../../store/planHooks';

import styles from './BomPanel.module.css';

/**
 * Room count and floor areas, at the top of the BOM panel once a room or a floor
 * exists. Floored area sums every floor (overlaps count twice, as in the BOM).
 */
export const BuildingSummary = () => {
  const { summary, floors } = useDerivedPlan();
  const rooms = summary.roomCount > 0;
  const items: [label: string, value: string, shown: boolean][] = [
    ['Rooms', String(summary.roomCount), rooms],
    ['Clear floor', formatArea(summary.clearArea), rooms],
    ['Grid', formatArea(summary.gridArea), rooms],
    ['Footprint', formatArea(summary.footprintArea), rooms],
    ['Floors', formatArea(floors.reduce((sum, f) => sum + f.area, 0)), floors.length > 0],
  ];
  const shown = items.filter(([, , show]) => show);
  if (shown.length === 0) return null;
  return (
    <section className={styles.summary} aria-label="Building summary">
      {shown.map(([label, value]) => (
        <div key={label} className={styles.summaryItem}>
          <span className={styles.summaryLabel}>{label}</span>
          <span className={styles.value}>{value}</span>
        </div>
      ))}
    </section>
  );
};
