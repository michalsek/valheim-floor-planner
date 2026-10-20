/**
 * The interim work plane (`workPlaneAtom`): the walking surface of the highest storey
 * floor the cut still shows, 0 at All. Tools read it outside React, so it is kept in
 * step with the committed plan and the cut here rather than derived: a derived atom
 * would only follow the plan while mounted, and would need `planHooks` in `session`.
 */
import { workPlaneOf } from '../model/cut';

import { hasLibrary } from './libraryInstance';
import { getStoreyStops } from './planHooks';
import type { PlanStore } from './planStore';
import { cutHeightAtom, workPlaneAtom, type SessionStore } from './session';

const planeOf = (plans: PlanStore, session: SessionStore): number => {
  const h = session.get(cutHeightAtom);
  // At All it is 0 whatever the stops; the cut can't be set before the catalogue loads.
  if (h === null || !hasLibrary()) return 0;
  return workPlaneOf(getStoreyStops(plans.getPlan()), h);
};

/** Keeps `workPlaneAtom` current from now on; returns the stop function. */
export const startWorkPlaneSync = (plans: PlanStore, session: SessionStore): (() => void) => {
  const sync = () => {
    const next = planeOf(plans, session);
    if (next !== session.get(workPlaneAtom)) session.set(workPlaneAtom, next);
  };
  sync();
  const stopPlan = plans.subscribe(sync);
  const stopCut = session.sub(cutHeightAtom, sync);
  return () => {
    stopPlan();
    stopCut();
  };
};
