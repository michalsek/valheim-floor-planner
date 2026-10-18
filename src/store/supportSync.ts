/**
 * Structural support of the committed plan, worked out lazily and off the commit path:
 * only while something shows it (the support view, or the Integrity list open on
 * screen), and only once the browser is idle after a change. Until then the last result
 * stays up (support colours of a moved piece lag a moment), marked as not fresh.
 */
import { atom, useAtomValue } from 'jotai';

import { roofContacts } from '../model/roofs/roofContacts';
import { planSupport, type GroundUnder, type PlanSupport } from '../model/support/planSupport';
import { groundUnder } from '../model/terrain/siteTerrain';
import type { Plan } from '../model/types';

import { getLibrary } from './libraryInstance';
import { getDerived, getPieceBoxes, usePlan } from './planHooks';
import type { PlanStore } from './planStore';
import { supportViewAtom, type SessionStore } from './session';
import { getSiteGround } from './siteTerrain';

/** The Integrity list is open and on screen. */
export const integrityShownAtom = atom<boolean>(false);

const supportWantedAtom = atom((get) => get(supportViewAtom) || get(integrityShownAtom));

/** The last support worked out, and the plan it is for. */
const supportAtom = atom<{ plan: Plan; support: PlanSupport } | null>(null);

/** How long an idle callback may wait before it runs anyway (ms). */
const IDLE_TIMEOUT = 100;

const whenIdle = (run: () => void): (() => void) => {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(run, { timeout: IDLE_TIMEOUT });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 0);
  return () => clearTimeout(handle);
};

/**
 * The site's ground under a footprint, whether the terrain is shown or not; null on flat
 * ground. Off the patch (far from the import) the ground is the datum, 0.
 */
const siteGroundUnder = (plan: Plan): GroundUnder | null => {
  const site = getSiteGround(plan);
  return site && ((footprint) => groundUnder(site.grid, site.frame, footprint) ?? 0);
};

/** Raw pieces hold up what rests on them but aren't checked themselves (an info note says so). */
export const computeSupport = (plan: Plan): PlanSupport =>
  planSupport(
    getPieceBoxes(plan),
    getLibrary().catalog.materialSupport,
    roofContacts(plan, getDerived(plan), getLibrary()),
    siteGroundUnder(plan)
  );

/** Keeps `supportAtom` following the committed plan while support is wanted. */
export const startSupportSync = (plans: PlanStore, session: SessionStore): (() => void) => {
  let cancel: (() => void) | null = null;
  const schedule = () => {
    cancel?.();
    cancel = null;
    if (!session.get(supportWantedAtom)) return;
    if (session.get(supportAtom)?.plan === plans.getPlan()) return;
    cancel = whenIdle(() => {
      cancel = null;
      const plan = plans.getPlan();
      session.set(supportAtom, { plan, support: computeSupport(plan) });
    });
  };
  const stopPlan = plans.subscribe(schedule);
  const stopWanted = session.sub(supportWantedAtom, schedule);
  return () => {
    cancel?.();
    stopPlan();
    stopWanted();
  };
};

/** The latest support (null before the first), and whether it is for the current plan. */
export const useSupport = (): { support: PlanSupport | null; fresh: boolean } => {
  const latest = useAtomValue(supportAtom);
  const plan = usePlan();
  return { support: latest?.support ?? null, fresh: latest?.plan === plan };
};
