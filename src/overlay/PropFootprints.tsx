import { library } from '../catalog';
import { groupVar } from '../catalog/groupColors';
import { propRect } from '../catalog/propDefs';
import { propCorners } from '../model/geometry/propGeometry';
import { propsInDrawOrder } from '../model/props';
import type { Prop } from '../model/types';
import { useDisplayPlan } from '../store/planHooks';

import styles from './Overlay.module.css';
import { toSvgPoints } from './svgPoints';

interface PropFootprintProps {
  prop: Pick<Prop, 'prefab' | 'position' | 'rotation'>;
  className?: string | undefined;
}

/**
 * One prop's footprint, filled in its group colour (world layer). Dashed when the game
 * data has no collider and the footprint is a 1 × 1 stand-in.
 */
export const PropFootprint = ({ prop, className }: PropFootprintProps) => {
  const def = library.propDefs.get(prop.prefab);
  const color = groupVar(def?.group);
  const corners = propCorners(
    prop.position,
    prop.rotation,
    propRect(library.propDefs, prop.prefab)
  );
  const approx = !def || def.approximate ? ` ${styles.propApprox}` : '';
  return (
    <polygon
      className={`${styles.propFootprint}${approx} ${className ?? ''}`}
      points={toSvgPoints(corners)}
      style={{ fill: color, stroke: color }}
      vectorEffect="non-scaling-stroke"
    />
  );
};

/**
 * Every prop's footprint (world layer, above walls so overlaps show through), larger
 * ones first so smaller ones stay on top, as they are hit.
 */
export const PropFootprints = () => {
  const props = propsInDrawOrder(useDisplayPlan(), library.propDefs);
  return (
    <g>
      {props.map((prop) => (
        <PropFootprint key={prop.id} prop={prop} />
      ))}
    </g>
  );
};
