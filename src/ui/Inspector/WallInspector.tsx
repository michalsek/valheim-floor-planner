import { formatMetres } from '../../format';
import { runSegments } from '../../model/geometry/polyline';
import type { WallId, WallRun } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { useDisplayDerived, useDisplayPlan } from '../../store/planHooks';
import { useToolContext } from '../../tools/toolContext';
import type { WallSettings } from '../../tools/Wall/wallDraft';
import { WallSettingsFields } from '../../tools/Wall/WallSettingsFields';
import { Row, Section } from '../shared/PanelList';

import styles from './Inspector.module.css';
import { ElevationField } from './ElevationField';
import { InspectorTitle } from './InspectorTitle';
import { ItemWarnings } from './ItemWarnings';
import { PieceActions } from './PieceActions';
import { PieceCost } from './PieceCost';

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

/**
 * A wall run: family, height and strip side (undoable), its segments, and its pieces
 * (its openings' included).
 */
export const WallInspector = ({ id }: { id: WallId }) => {
  const ctx = useToolContext();
  const plan = useDisplayPlan();
  const wall = plan.walls[id];
  const { pieces } = useDisplayDerived();
  if (!wall) return null;

  const family = getLibrary().wallFamilies.get(wall.familyId);
  const segs = runSegments(wall);
  const total = segs.reduce((sum, s) => sum + s.length, 0);
  const own = (sourceId: string) => sourceId === id || plan.openings[sourceId]?.wallId === id;

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
        <ElevationField item={{ kind: 'wall', id }} />
      </div>
      <ItemWarnings item={{ kind: 'wall', id }} />
      <PieceActions />
      <Section title={wall.closed ? 'Loop' : 'Run'}>
        {segs.map((seg, i) => (
          <Row key={i} label={`Segment ${i + 1}`} value={formatMetres(seg.length)} />
        ))}
        <Row label="Total" value={formatMetres(total)} />
      </Section>
      <PieceCost pieces={pieces.filter((p) => own(p.sourceId))} />
    </>
  );
};
