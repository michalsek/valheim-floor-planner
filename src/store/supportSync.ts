/**
 * Structural support of the committed plan, worked out lazily and off the commit path:
 * only while something shows or uses it (the support view, the Integrity list open on
 * screen, a tool with a live support preview), and only once the browser is idle after
 * a change. Until then the last result stays up (support colours of a moved piece lag a
 * moment), marked as not fresh.
 */
import { atom, useAtomValue } from 'jotai';

import type { CommittedIndex } from '../model/support/ghostSupport';
import {
  modelSupport,
  supportModel,
  type GroundUnder,
  type PlanSupport,
} from '../model/support/planSupport';
import { snapJoints } from '../model/support/snapJoints';
import { groundUnderOrEdge } from '../model/terrain/siteTerrain';
import type { Plan } from '../model/types';

import { getLibrary } from './libraryInstance';
import { getPieceBoxes, usePlan } from './planHooks';
import type { PlanStore } from './planStore';
import { activeToolIdAtom, supportViewAtom, type SessionStore } from './session';
import { getSiteGround } from './siteTerrain';

/** The Integrity list is open and on screen. */
export const integrityShownAtom = atom<boolean>(false);

/**
 * Tools that preview support live (the ghost's value), so the committed result must
 * follow each commit while they are active. Strings, not `ToolId`s, so an id can be
 * listed before its tool exists.
 */
const SUPPORT_TOOLS: ReadonlySet<string> = new Set(['build']);

const supportWantedAtom = atom(
  (get) =>
    get(supportViewAtom) || get(integrityShownAtom) || SUPPORT_TOOLS.has(get(activeToolIdAtom))
);

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
 * ground. Off the patch (64 m or more from the import) the patch's nearest edge carries
 * on flat, not the datum: the datum is the build's lowest piece, which may sit metres
 * above or below the ground there.
 */
const siteGroundUnder = (plan: Plan): GroundUnder | null => {
  const site = getSiteGround(plan);
  return site && ((footprint) => groundUnderOrEdge(site.grid, site.frame, footprint));
};

const indexCache = new WeakMap<Plan, CommittedIndex>();

/**
 * A committed plan's support bodies, contact hash and snap joints (memoised per plan
 * object): what `computeSupport` solves, and what a ghost's support is found against
 * (`ghostSupport`), so both see the same bodies.
 */
export const committedSupportIndex = (plan: Plan): CommittedIndex => {
  let index = indexCache.get(plan);
  if (!index) {
    const boxes = getPieceBoxes(plan);
    const lib = getLibrary();
    index = {
      model: supportModel(boxes, lib.catalog.materialSupport, siteGroundUnder(plan)),
      joints: snapJoints(boxes, lib),
    };
    indexCache.set(plan, index);
  }
  return index;
};

/** Every box checked, with snap joints declared. */
export const computeSupport = (plan: Plan): PlanSupport => {
  const { model, joints } = committedSupportIndex(plan);
  return modelSupport(model, joints.pairs);
};

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

/**
 * The latest support and the plan it is for (null before the first), for code outside
 * React (a ghost's derived atom): fresh when `plan` is the committed plan.
 */
export const latestSupportAtom = atom((get) => get(supportAtom));

/** The latest support (null before the first), and whether it is for the current plan. */
export const useSupport = (): { support: PlanSupport | null; fresh: boolean } => {
  const latest = useAtomValue(supportAtom);
  const plan = usePlan();
  return { support: latest?.support ?? null, fresh: latest?.plan === plan };
};
