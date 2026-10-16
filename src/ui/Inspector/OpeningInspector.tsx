import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { Select } from '../../controls/Select';
import { formatMetres, formatNumber, formatSize } from '../../format';
import type { OpeningId } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { useDisplayDerived, useDisplayPlan } from '../../store/planHooks';
import { selectionAtom } from '../../store/selection';
import { useToolContext } from '../../tools/toolContext';
import { Row, Section } from '../shared/PanelList';

import styles from './Inspector.module.css';
import { InspectorTitle } from './InspectorTitle';
import { ItemWarnings } from './ItemWarnings';
import { PieceCost } from './PieceCost';

const openingOptions = () =>
  [...getLibrary().openingDefs.values()].map((d) => ({
    value: d.prefab,
    label: `${d.label} · ${formatSize(d.width, d.height)} m`,
  }));

/**
 * An opening: which prefab (undoable; a wider one may no longer fit, which the
 * warnings say), its size and place on the wall, and its cost.
 */
export const OpeningInspector = ({ id }: { id: OpeningId }) => {
  const ctx = useToolContext();
  const plan = useDisplayPlan();
  const opening = plan.openings[id];
  const { pieces, openings } = useDisplayDerived();
  const resolved = openings.find((o) => o.id === id);
  if (!opening) return null;
  const wall = plan.walls[opening.wallId];
  const family = wall && getLibrary().wallFamilies.get(wall.familyId);
  const def = resolved?.def;

  return (
    <>
      <InspectorTitle title={def?.label ?? 'Opening'} />
      <div className={styles.fields}>
        <Field label="Opening">
          <Select
            label="Change opening"
            options={openingOptions()}
            value={opening.prefab}
            onChange={(prefab) =>
              ctx.plan.dispatch(
                { type: 'opening.patch', id, changes: { prefab } },
                { label: 'Change opening' }
              )
            }
          />
        </Field>
        <Button
          title="Select the wall this opening is in"
          onClick={() => ctx.set(selectionAtom, [{ kind: 'wall', id: opening.wallId }])}
        >
          Select wall
        </Button>
      </div>
      <ItemWarnings item={{ kind: 'opening', id }} />
      <Section title="Opening">
        {def && <Row label="Width" value={formatMetres(def.width)} />}
        {def && <Row label="Height" value={formatMetres(def.height)} />}
        {resolved && resolved.segment !== null && def && (
          <Row
            label={`Segment ${resolved.segment + 1}`}
            value={`${formatNumber(resolved.start, 1)}–${formatNumber(resolved.start + def.width, 1)} m`}
          />
        )}
        <Row label="Wall" value={family?.label ?? wall?.familyId ?? '—'} />
      </Section>
      <PieceCost pieces={pieces.filter((p) => p.sourceId === id)} />
    </>
  );
};
