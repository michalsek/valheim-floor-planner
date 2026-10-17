import { useAtomValue } from 'jotai';
import type { ComponentType } from 'react';

import { keepFocus } from '../../controls/keepFocus';
import { formatMetres } from '../../format';
import { measure } from '../../model/geometry/measure';
import type { SelectionItem, SelectionKind } from '../../model/selection';
import type { DimId } from '../../model/types';
import { useDisplayPlan } from '../../store/planHooks';
import { selectionAtom } from '../../store/selection';
import { deleteSelection } from '../../tools/Select/selectActions';
import { useToolContext } from '../../tools/toolContext';
import { Row, Section } from '../shared/PanelList';

import styles from './Inspector.module.css';
import { ElevationField } from './ElevationField';
import { InspectorTitle } from './InspectorTitle';
import { FloorInspector } from './FloorInspector';
import { OpeningInspector } from './OpeningInspector';
import { PropInspector } from './PropInspector';
import { RoofInspector } from './RoofInspector';
import { WallInspector } from './WallInspector';

const DimensionInspector = ({ id }: { id: DimId }) => {
  const dim = useDisplayPlan().dimensions[id];
  if (!dim) return null;
  const { length, dx, dz } = measure(dim.a, dim.b);
  return (
    <>
      <InspectorTitle title="Dimension" />
      <div className={styles.fields}>
        <ElevationField item={{ kind: 'dimension', id }} />
      </div>
      <Section title="Measures">
        <Row label="Length" value={formatMetres(length)} />
        <Row label="Δx" value={formatMetres(dx)} />
        <Row label="Δz" value={formatMetres(dz)} />
      </Section>
    </>
  );
};

/** Each kind's inspector for one selected item; a missing kind fails to compile. */
const INSPECTORS: { readonly [K in SelectionKind]: ComponentType<{ id: string }> } = {
  wall: WallInspector,
  opening: OpeningInspector,
  floor: FloorInspector,
  dimension: DimensionInspector,
  prop: PropInspector,
  roof: RoofInspector,
};

const ItemInspector = ({ item }: { item: SelectionItem }) => {
  const Kind = INSPECTORS[item.kind];
  return <Kind id={item.id} />;
};

/** Details and edits for the selection; nothing when the selection is empty. */
export const Inspector = () => {
  const selection = useAtomValue(selectionAtom);
  const ctx = useToolContext();
  const [primary] = selection;
  if (!primary) return null;
  return (
    <section className={styles.inspector} aria-label="Inspector">
      {selection.length === 1 ? (
        <ItemInspector item={primary} />
      ) : (
        <InspectorTitle title={`${selection.length} items selected`} />
      )}
      <div className={styles.footer}>
        <button
          type="button"
          className={styles.delete}
          title="Delete the selection (Delete)"
          onMouseDown={keepFocus}
          onClick={() => deleteSelection(ctx)}
        >
          Delete
        </button>
      </div>
    </section>
  );
};
