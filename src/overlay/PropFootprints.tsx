import { useAtomValue } from 'jotai';

import { groupVar } from '../catalog/groupColors';
import { propRect, type LocalRect } from '../catalog/propDefs';
import { propCorners, rotate } from '../model/geometry/propGeometry';
import { propsInDrawOrder } from '../model/props';
import type { Prop, Vec2 } from '../model/types';
import { getLibrary } from '../store/libraryInstance';
import { bandOf, supportBandColor } from '../scene/supportColors';
import { useThemeTokens } from '../store/hooks';
import { useLevelPlan } from '../store/planHooks';
import { supportViewAtom } from '../store/session';
import { useSupport } from '../store/supportSync';

import styles from './Overlay.module.css';
import { toSvgPoints } from './svgPoints';

interface PropFootprintProps {
  prop: Pick<Prop, 'prefab' | 'position' | 'rotation'>;
  className?: string | undefined;
  /** Fill and stroke instead of the group colour (the support view's band). */
  color?: string | undefined;
}

/** Treads drawn across a stair's footprint. */
const TREADS = 4;

/** Stairs and ladders: treads across the footprint and an arrow up the flight (local −z). */
const StairGlyph = ({ prop, rect }: { prop: PropFootprintProps['prop']; rect: LocalRect }) => {
  const at = (x: number, z: number): Vec2 => {
    const p = rotate({ x, z }, prop.rotation);
    return { x: prop.position.x + p.x, z: prop.position.z + p.z };
  };
  const run = rect.maxZ - rect.minZ;
  const cx = (rect.minX + rect.maxX) / 2;
  const treads = Array.from({ length: TREADS }, (_, i) => {
    const z = rect.maxZ - ((i + 1) * run) / (TREADS + 1);
    return [at(rect.minX, z), at(rect.maxX, z)];
  });
  const head = Math.min(run, rect.maxX - rect.minX) * 0.2;
  const tip = rect.minZ + run * 0.12;
  const arrow = [at(cx, rect.maxZ - run * 0.12), at(cx, tip)];
  const barbs = [at(cx - head, tip + head), at(cx, tip), at(cx + head, tip + head)];
  return (
    <g className={styles.stairGlyph}>
      {[...treads, arrow, barbs].map((points, i) => (
        <polyline key={i} points={toSvgPoints(points)} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
};

/**
 * One prop's footprint, filled in its group colour (world layer). Dashed when the game
 * data has no collider and the footprint is a 1 × 1 stand-in. Stairs and ladders show
 * their treads and which way is up.
 */
export const PropFootprint = ({ prop, className, color: override }: PropFootprintProps) => {
  const def = getLibrary().propDefs.get(prop.prefab);
  const color = override ?? groupVar(def?.group);
  const rect = propRect(getLibrary().propDefs, prop.prefab);
  const corners = propCorners(prop.position, prop.rotation, rect);
  const approx = !def || def.approximate ? ` ${styles.propApprox}` : '';
  return (
    <>
      <polygon
        className={`${styles.propFootprint}${approx} ${className ?? ''}`}
        points={toSvgPoints(corners)}
        style={{ fill: color, stroke: color }}
        vectorEffect="non-scaling-stroke"
      />
      {def?.flight && <StairGlyph prop={prop} rect={rect} />}
    </>
  );
};

/**
 * Every prop's footprint on the current level (world layer, above walls so overlaps
 * show through), larger ones first so smaller ones stay on top, as they are hit. In the
 * support view, props that take part are filled in their support band's colour.
 */
export const PropFootprints = () => {
  const props = propsInDrawOrder(useLevelPlan(), getLibrary().propDefs);
  const supportView = useAtomValue(supportViewAtom);
  const { support } = useSupport();
  const tokens = useThemeTokens();
  const colorOf = (id: string) =>
    supportView
      ? (supportBandColor(tokens, bandOf(support, `prop:${id}`)) ?? undefined)
      : undefined;
  return (
    <g>
      {props.map((prop) => (
        <PropFootprint key={prop.id} prop={prop} color={colorOf(prop.id)} />
      ))}
    </g>
  );
};
