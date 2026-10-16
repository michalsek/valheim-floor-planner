import type { ReactNode } from 'react';

import { itemLabel } from '../../catalog/items';
import { emptyPlan, type Plan } from '../../model/types';
import { planStore } from '../../store/planInstance';
import { useDerivedPlan, usePlanSelector, useUndoRedo } from '../../store/planHooks';

import styles from './BomPanel.module.css';
import { AutosaveNotice } from './AutosaveNotice';
import { BuildingSummary } from './BuildingSummary';
import { PlanActions } from './PlanActions';

const isEmpty = (plan: Plan) =>
  Object.keys(plan.walls).length === 0 && Object.keys(plan.dimensions).length === 0;

/** Bill of materials: piece counts, total resources and plan warnings. */
export const BomPanel = () => {
  const { bom, warnings } = useDerivedPlan();
  const empty = usePlanSelector(isEmpty);
  const undoRedo = useUndoRedo();

  return (
    <aside className={styles.panel} aria-label="Bill of materials">
      <PlanActions
        undoRedo={undoRedo}
        canClear={!empty}
        onClear={() => {
          if (window.confirm('Clear the whole plan? You can undo this.')) {
            planStore.dispatch(
              { type: 'plan.replace', plan: emptyPlan() },
              { label: 'Clear plan' }
            );
          }
        }}
      />
      <AutosaveNotice />
      <div className={styles.body}>
        <BuildingSummary />
        {bom.pieces.length === 0 ? (
          <p className={styles.empty}>Draw walls (W) to see what they cost.</p>
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
              <li key={i} className={styles.warning}>
                {w.message}
              </li>
            ))}
          </Section>
        )}
      </div>
    </aside>
  );
};

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className={styles.section}>
    <h2 className={styles.heading}>{title}</h2>
    <ul className={styles.list}>{children}</ul>
  </section>
);

const Row = ({ label, value }: { label: string; value: number }) => (
  <li className={styles.row}>
    <span>{label}</span>
    <span className={styles.value}>{value}</span>
  </li>
);
