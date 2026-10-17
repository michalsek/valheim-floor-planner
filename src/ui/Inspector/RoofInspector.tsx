import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { NumberInput } from '../../controls/NumberInput';
import { formatMetres, formatSize } from '../../format';
import { ringBox } from '../../model/geometry/rings';
import { MAX_ROOF_BASE } from '../../model/roofs/roofCheck';
import type { RoofId } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { useDisplayDerived, useDisplayPlan } from '../../store/planHooks';
import { patchRoof, refitRoof, roofChanges, roofFields } from '../../tools/Roof/roofActions';
import { isRectangle } from '../../tools/Roof/roofState';
import { RoofSettingsFields } from '../../tools/Roof/RoofSettingsFields';
import { useToolContext } from '../../tools/toolContext';
import { Row, Section } from '../shared/PanelList';

import styles from './Inspector.module.css';
import { ElevationField } from './ElevationField';
import { InspectorTitle } from './InspectorTitle';
import { ItemWarnings } from './ItemWarnings';
import { PieceCost } from './PieceCost';

/**
 * A roof: its settings and the wall top it rests on (each edit one undo step), its
 * size and heights, warnings, and what its pieces cost. Re-fit reads the room under it
 * again: roofs don't follow wall edits.
 */
export const RoofInspector = ({ id }: { id: RoofId }) => {
  const ctx = useToolContext();
  const roof = useDisplayPlan().roofs[id];
  const { roofPieces } = useDisplayDerived();
  if (!roof) return null;
  const family = getLibrary().roofFamilies.get(roof.familyId);
  const pieces = roofPieces.filter((p) => p.sourceId === id);
  const cells = pieces.filter((p) => p.cell !== null);
  const low = Math.min(...cells.map((p) => p.center.y - p.size.y / 2));
  const high = Math.max(...cells.map((p) => p.center.y + p.size.y / 2));
  const top = roof.elevation + roof.base;
  const { w, d } = ringBox(roof.outline);

  return (
    <>
      <InspectorTitle title={`${family?.label ?? roof.familyId} roof`} />
      <div className={styles.fields}>
        <RoofSettingsFields
          value={roofFields(roof)}
          onChange={(changes) => patchRoof(ctx, roof, roofChanges(roof, changes), 'Edit roof')}
          autoRidge={false}
          rectangular={isRectangle(roof.outline)}
        />
        <Field label="Wall top" suffix="m">
          <NumberInput
            key={roof.base}
            label="Wall top above the level, in metres"
            value={roof.base}
            step={0.5}
            onCommit={(base) => {
              if (base > 0 && base <= MAX_ROOF_BASE) patchRoof(ctx, roof, { base }, 'Edit roof');
            }}
          />
        </Field>
        <ElevationField item={{ kind: 'roof', id }} />
        <Button
          title="Fit the roof to the room under it and its walls' height again"
          onClick={() => refitRoof(ctx, roof)}
        >
          Re-fit to room
        </Button>
      </div>
      <ItemWarnings item={{ kind: 'roof', id }} />
      <Section title="Roof">
        <Row label="Outline" value={`${formatSize(w, d)} m`} />
        {cells.length > 0 && (
          <>
            <Row label="Eave" value={`${formatMetres(top - low)} below the wall top`} />
            <Row label="Ridge" value={`${formatMetres(high - top)} above the wall top`} />
          </>
        )}
      </Section>
      <PieceCost pieces={pieces} />
    </>
  );
};
