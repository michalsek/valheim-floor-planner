import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { NumberInput } from '../../controls/NumberInput';
import { formatMetres, formatSize } from '../../format';
import { normalizeDeg } from '../../model/geometry/propGeometry';
import { rawDef, rawRect, rawSpan } from '../../model/rawPieces';
import type { RawPieceId } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';
import { useDisplayPlan } from '../../store/planHooks';
import { rotateItems } from '../../tools/Select/selectActions';
import { useToolContext } from '../../tools/toolContext';
import { Row, Section } from '../shared/PanelList';

import styles from './Inspector.module.css';
import { ElevationField } from './ElevationField';
import { InspectorTitle } from './InspectorTitle';
import { ItemWarnings } from './ItemWarnings';
import { PieceCost } from './PieceCost';

/**
 * An imported game piece kept as it is: names and prefab, yaw (turned about its
 * footprint's centre), its height on the level, collider size and cost.
 */
export const RawPieceInspector = ({ id }: { id: RawPieceId }) => {
  const ctx = useToolContext();
  const piece = useDisplayPlan().rawPieces[id];
  if (!piece) return null;
  const def = rawDef(getLibrary(), piece);
  const rect = rawRect(def);
  const span = rawSpan(def);
  const { yaw, pitch, roll } = piece.rotation;

  // A turn that ends where it started adds no entry.
  const rotateBy = (delta: number) => {
    if (normalizeDeg(yaw + delta) === yaw) return;
    rotateItems(ctx, delta, [{ kind: 'raw', id }]);
  };

  return (
    <>
      <InspectorTitle title={def?.name ?? piece.prefab} />
      <p className={styles.subtitle}>
        {def && def.namePl !== def.name && `${def.namePl} · `}
        <code>{piece.prefab}</code> · imported as is
      </p>
      <div className={styles.fields}>
        <Field label="Rotation" suffix="°">
          <Button title="Turn 22.5° anticlockwise" onClick={() => rotateBy(-22.5)}>
            ⟲
          </Button>
          <NumberInput
            key={yaw}
            label="Rotation in degrees"
            value={yaw}
            step={22.5}
            onCommit={(deg) => rotateBy(normalizeDeg(deg) - yaw)}
          />
          <Button title="Turn 22.5° clockwise (Shift+R)" onClick={() => rotateBy(22.5)}>
            ⟳
          </Button>
        </Field>
        <ElevationField item={{ kind: 'raw', id }} />
      </div>
      <ItemWarnings item={{ kind: 'raw', id }} />
      <Section title="Piece">
        <Row
          label="Pivot height"
          value={`${formatMetres(Math.abs(piece.position.y))} ${piece.position.y < 0 ? 'below' : 'above'} the level`}
        />
        <Row
          label="Collider"
          value={`${formatSize(rect.maxX - rect.minX, rect.maxZ - rect.minZ, 2)} × ${formatMetres(span.maxY - span.minY)}`}
        />
        {(pitch !== 0 || roll !== 0) && <Row label="Tilt" value={`${pitch}° · ${roll}°`} />}
      </Section>
      <PieceCost pieces={[piece]} />
    </>
  );
};
