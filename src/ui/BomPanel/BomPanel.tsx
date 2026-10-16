import { itemLabel } from '../../catalog/items';
import { useDerivedPlan, useUndoRedo } from '../../store/planHooks';
import { Row, Section } from '../shared/PanelList';

import { AutosaveNotice } from './AutosaveNotice';
import styles from './BomPanel.module.css';
import { BuildingSummary } from './BuildingSummary';
import { HistoryList } from './HistoryList';
import { PlanActions } from './PlanActions';

/** Undo history, then the bill of materials: piece counts, resources and warnings. */
export const BomPanel = () => {
  const { bom, warnings } = useDerivedPlan();
  const undoRedo = useUndoRedo();

  return (
    <aside className={styles.panel} aria-label="Bill of materials">
      <PlanActions undoRedo={undoRedo} />
      <HistoryList />
      <AutosaveNotice />
      <div className={styles.body}>
        <BuildingSummary />
        {bom.pieces.length === 0 ? (
          <p className={styles.empty}>Draw walls (W) or floors (B) to see what they cost.</p>
        ) : (
          <>
            <Section title="Pieces">
              {bom.pieces.map((line) => (
                <Row key={line.prefab} label={line.name} value={line.count} />
              ))}
            </Section>
            <Section title="Resources">
              {bom.resources.map((line) => (
                <Row key={line.item} label={itemLabel(line.item)} value={line.amount} />
              ))}
            </Section>
          </>
        )}
        {warnings.length > 0 && (
          <Section title="Warnings">
            {warnings.map((w, i) => (
              <li key={i} className={w.level === 'info' ? styles.info : styles.warning}>
                {w.message}
              </li>
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
};
