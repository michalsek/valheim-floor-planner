/**
 * The committed plan as an atom, so derived atoms (the cursor, the Build ghost) follow a
 * commit, an undo or a load at once. Tools read it outside React (`ctx.get`), so it is
 * kept in step with the plan store here rather than fed on mount: an `onMount` atom goes
 * stale while nothing in React reads it.
 */
import { atom } from 'jotai';

import { emptyPlan, type Plan } from '../model/types';

import type { PlanStore } from './planStore';
import type { SessionStore } from './session';

/** Written only by `startCommittedPlanSync`. */
const base = atom<Plan>(emptyPlan());

/** The plan store's current plan (read-only). */
export const committedPlanAtom = atom((get) => get(base));

/** Seeds `committedPlanAtom` from `plans` and keeps it current; returns the stop function. */
export const startCommittedPlanSync = (plans: PlanStore, session: SessionStore): (() => void) => {
  const sync = () => {
    const plan = plans.getPlan();
    if (plan !== session.get(base)) session.set(base, plan);
  };
  sync();
  return plans.subscribe(sync);
};
