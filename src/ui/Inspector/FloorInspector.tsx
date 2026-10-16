import { formatArea, formatMetres, formatSize } from '../../format';
import type { FloorId } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { useDisplayDerived, useDisplayPlan } from '../../store/planHooks';
import { FloorSettingsFields } from '../../tools/Floor/FloorSettingsFields';
import { useToolContext } from '../../tools/toolContext';
import { Row, Section } from '../shared/PanelList';

import styles from './Inspector.module.css';
import { InspectorTitle } from './InspectorTitle';
import { ItemWarnings } from './ItemWarnings';
import { PieceCost } from './PieceCost';

/** A floor: family (undoable), size, area, thickness, tiles and their cost. */
export const FloorInspector = ({ id }: { id: FloorId }) => {
  const ctx = useToolContext();
  const floor = useDisplayPlan().floors[id];
  const { pieces, floors } = useDisplayDerived();
  const info = floors.find((f) => f.id === id);
  if (!floor || !info) return null;
  const family = getLibrary().floorFamilies.get(floor.familyId);

  return (
    <>
      <InspectorTitle title={`${family?.label ?? floor.familyId} floor`} />
      <div className={styles.fields}>
        <FloorSettingsFields
          familyId={floor.familyId}
          onChange={(familyId) =>
            ctx.plan.dispatch(
              { type: 'floor.patch', id, changes: { familyId } },
              { label: 'Change floor family' }
            )
          }
        />
      </div>
      <ItemWarnings item={{ kind: 'floor', id }} />
      <Section title="Floor">
        <Row label="Size" value={`${formatSize(info.size.x, info.size.z)} m`} />
        <Row label="Area" value={formatArea(info.area)} />
        {family && <Row label="Thickness" value={formatMetres(family.thickness)} />}
      </Section>
      <PieceCost pieces={pieces.filter((p) => p.sourceId === id)} />
    </>
  );
};
