import { propRect, rectSize } from '../../catalog/propDefs';
import { propRadius, type PropRadius } from '../../catalog/stations';
import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { NumberInput } from '../../controls/NumberInput';
import { Stepper } from '../../controls/Stepper';
import { formatCompact, formatSize } from '../../format';
import { normalizeDeg } from '../../model/geometry/propGeometry';
import type { PropId } from '../../model/types';
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

/** "28 m (20 + 2 × 4)", or "Ward 32 m". */
const describeRadius = (radius: PropRadius, upgrades: number): string => {
  const r = `${formatCompact(radius.radius)} m`;
  if (radius.kind === 'ward') return `Ward ${r}`;
  if (radius.maxUpgrades === 0) return r;
  const n = Math.min(upgrades, radius.maxUpgrades);
  return `${r} (${formatCompact(radius.base)} + ${n} × ${formatCompact(radius.perUpgrade)})`;
};

/**
 * A placed item: names and prefab, footprint, rotation (turned about its centre),
 * comfort, station upgrades with the build radius, and what it costs.
 */
export const PropInspector = ({ id }: { id: PropId }) => {
  const ctx = useToolContext();
  const prop = useDisplayPlan().props[id];
  if (!prop) return null;
  const def = getLibrary().propDefs.get(prop.prefab);
  const size = rectSize(propRect(getLibrary().propDefs, prop.prefab));
  const radius = propRadius(prop.prefab, prop.upgrades, getLibrary().catalog);

  // A turn that ends where it started (360°, or the same angle typed) adds no entry.
  const rotateBy = (delta: number) => {
    if (normalizeDeg(prop.rotation + delta) === prop.rotation) return;
    rotateItems(ctx, delta, [{ kind: 'prop', id }]);
  };

  return (
    <>
      <InspectorTitle title={def?.name ?? prop.prefab} />
      <p className={styles.subtitle}>
        {def && def.namePl !== def.name && `${def.namePl} · `}
        <code>{prop.prefab}</code>
      </p>
      <div className={styles.fields}>
        <Field label="Rotation" suffix="°">
          <Button title="Turn 22.5° anticlockwise" onClick={() => rotateBy(-22.5)}>
            ⟲
          </Button>
          <NumberInput
            key={prop.rotation}
            label="Rotation in degrees"
            value={prop.rotation}
            step={22.5}
            onCommit={(deg) => rotateBy(normalizeDeg(deg) - prop.rotation)}
          />
          <Button title="Turn 22.5° clockwise (Shift+R)" onClick={() => rotateBy(22.5)}>
            ⟳
          </Button>
        </Field>
        <ElevationField item={{ kind: 'prop', id }} />
        {radius && radius.maxUpgrades > 0 && (
          <Field label="Upgrades">
            <Stepper
              label="Upgrades"
              value={Math.min(prop.upgrades, radius.maxUpgrades)}
              min={0}
              max={radius.maxUpgrades}
              onChange={(upgrades) =>
                ctx.plan.dispatch(
                  { type: 'prop.patch', id, changes: { upgrades } },
                  { label: 'Set upgrades' }
                )
              }
            />
          </Field>
        )}
      </div>
      <ItemWarnings item={{ kind: 'prop', id }} />
      {def?.approximate && (
        <p className={styles.warning}>
          Approximate footprint: the game data has no collider for this piece.
        </p>
      )}
      <Section title="Item">
        <Row label="Footprint" value={`${formatSize(size.x, size.z, 2)} m`} />
        {def && def.comfort > 0 && <Row label="Comfort" value={def.comfort} />}
        {radius && (
          <Row
            label={radius.kind === 'ward' ? 'Protects' : 'Build radius'}
            value={describeRadius(radius, prop.upgrades)}
          />
        )}
      </Section>
      <PieceCost pieces={[prop]} />
    </>
  );
};
