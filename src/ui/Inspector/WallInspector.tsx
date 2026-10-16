import { catalog, wallFamilyById } from '../../catalog';
import { formatMetres } from '../../format';
import { computeBom } from '../../model/bom';
import { runSegments } from '../../model/geometry/polyline';
import type { WallId, WallRun } from '../../model/types';
import { useDisplayDerived, useDisplayPlan } from '../../store/planHooks';
import { useToolContext } from '../../tools/toolContext';
import type { WallSettings } from '../../tools/Wall/wallDraft';
import { WallSettingsFields } from '../../tools/Wall/WallSettingsFields';
import { Row, Section } from '../shared/PanelList';

import styles from './Inspector.module.css';
import { InspectorTitle } from './InspectorTitle';

/** The history label for a settings change from `WallSettingsFields`. */
const changeLabel = (changes: Partial<WallSettings>): string => {
  if (changes.familyId !== undefined) return 'Change wall family';
  if (changes.height !== undefined) return 'Change wall height';
  return 'Flip wall side';
};

const settingsOf = ({ familyId, side, height }: WallRun): WallSettings => ({
  familyId,
  side,
  height,
});

/** A wall run: family, height and strip side (undoable), its segments and its pieces. */
export const WallInspector = ({ id }: { id: WallId }) => {
  const ctx = useToolContext();
  const wall = useDisplayPlan().walls[id];
  const { pieces } = useDisplayDerived();
  if (!wall) return null;

  const family = wallFamilyById.get(wall.familyId);
  const segs = runSegments(wall);
  const total = segs.reduce((sum, s) => sum + s.length, 0);
  const bom = computeBom(
    pieces.filter((p) => p.sourceId === id),
    catalog
  );

  return (
    <>
      <InspectorTitle title={`${family?.label ?? wall.familyId} wall`} />
      <div className={styles.fields}>
        <WallSettingsFields
          value={settingsOf(wall)}
          loop={wall.closed}
          onChange={(changes) =>
            ctx.plan.dispatch({ type: 'wall.patch', id, changes }, { label: changeLabel(changes) })
          }
        />
      </div>
      <Section title={wall.closed ? 'Loop' : 'Run'}>
        {segs.map((seg, i) => (
          <Row key={i} label={`Segment ${i + 1}`} value={formatMetres(seg.length)} />
        ))}
        <Row label="Total" value={formatMetres(total)} />
      </Section>
      {bom.pieces.length > 0 && (
        <Section title="Pieces">
          {bom.pieces.map((line) => (
            <Row key={line.prefab} label={line.name} value={line.count} />
          ))}
        </Section>
      )}
    </>
  );
};
