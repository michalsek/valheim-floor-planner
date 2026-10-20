import { useAtomValue } from 'jotai';
import { useState } from 'react';

import { itemLabel } from '../../catalog/items';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { levelIndex, levelPlan } from '../../model/levels';
import { getLibrary } from '../../store/libraryInstance';
import { getDerived, usePlan, useUndoRedo } from '../../store/planHooks';
import { workDatumAtom } from '../../store/session';
import { Row, Section } from '../shared/PanelList';

import { AutosaveNotice } from './AutosaveNotice';
import styles from './BomPanel.module.css';
import { HistoryList } from './HistoryList';
import { IntegrityList } from './IntegrityList';
import { PlanActions } from './PlanActions';

type Scope = 'level' | 'all';

const SCOPES: readonly { value: Scope; label: string }[] = [
  { value: 'level', label: 'This level' },
  { value: 'all', label: 'All' },
];

/**
 * Undo history, then the bill of materials for the whole plan or the current level:
 * piece counts, resources, what would collapse, and warnings.
 */
export const BomPanel = () => {
  const plan = usePlan();
  const datum = useAtomValue(workDatumAtom);
  const [scope, setScope] = useState<Scope>('all');
  const levelled = levelIndex(plan, getLibrary()).levels.length > 1;
  const level = levelled && scope === 'level';
  const { bom, warnings } = getDerived(level ? levelPlan(plan, datum, getLibrary()) : plan);
  const undoRedo = useUndoRedo();

  return (
    <aside className={styles.panel} aria-label="Bill of materials">
      <PlanActions undoRedo={undoRedo} />
      <HistoryList />
      <AutosaveNotice />
      <div className={styles.body}>
        {levelled && (
          <div className={styles.scope}>
            <SegmentedControl<Scope>
              label="Bill of materials for"
              options={SCOPES}
              value={scope}
              onChange={(v) => setScope(v)}
            />
          </div>
        )}
        {bom.pieces.length === 0 ? (
          <p className={styles.empty}>
            {level
              ? 'Nothing on this level yet.'
              : 'Build pieces (H) or place items (P) to see what they cost.'}
          </p>
        ) : (
          <>
            <Section title="Pieces">
              {bom.pieces.map((line) => (
                <Row key={line.prefab} label={line.name} value={line.count} />
              ))}
            </Section>
            <Section title="Resources">
              {bom.resources.map((line) => (
                <Row
                  key={line.item}
                  label={itemLabel(getLibrary(), line.item)}
                  value={line.amount}
                />
              ))}
            </Section>
          </>
        )}
        <IntegrityList level={level ? datum : null} />
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
