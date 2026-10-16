/**
 * Rules every stored prop must meet (commands and file parsing share them, so whatever
 * a command accepts also loads), and the order props are drawn and hit in.
 */
import type { Library } from '../catalog/library';
import { propRect, rectSize } from '../catalog/propDefs';

import type { Plan, Prop } from './types';

/** Props per plan, and upgrades per station. */
export const MAX_PROPS = 5_000;
export const MAX_UPGRADES = 20;

const isFinitePoint = (p: Prop['position']): boolean =>
  Number.isFinite(p.x) && Number.isFinite(p.z);

/** Why `prop` can't be stored, or null when it can. */
export const propProblem = (prop: Prop): string | null => {
  if (prop.prefab.length === 0) return 'an item needs a prefab';
  if (!isFinitePoint(prop.position)) return 'an item needs a finite position';
  if (!Number.isFinite(prop.rotation)) return 'an item needs a finite rotation';
  if (!Number.isInteger(prop.upgrades) || prop.upgrades < 0 || prop.upgrades > MAX_UPGRADES) {
    return `upgrades must be a whole number from 0 to ${MAX_UPGRADES}`;
  }
  return null;
};

/** Footprint area in m² (the 1 × 1 stand-in for unknown prefabs). */
export const propArea = (defs: Library['propDefs'], prefab: string): number => {
  const size = rectSize(propRect(defs, prefab));
  return size.x * size.z;
};

/**
 * Props bottom to top: larger footprints first, so smaller ones stay visible (and are
 * hit first) where they overlap; equal areas keep plan order.
 */
export const propsInDrawOrder = (plan: Pick<Plan, 'props'>, defs: Library['propDefs']): Prop[] =>
  Object.values(plan.props)
    .map((prop, index) => ({ prop, index, area: propArea(defs, prop.prefab) }))
    .sort((a, b) => b.area - a.area || a.index - b.index)
    .map(({ prop }) => prop);
