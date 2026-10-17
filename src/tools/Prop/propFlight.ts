/** The armed stair's or ladder's flight: how high it climbs and its pieces. */
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { flightSteps, riseToNextLevel, type FlightStep } from '../../model/flight';
import { getLibrary } from '../../store/libraryInstance';
import { usePlan } from '../../store/planHooks';
import { workDatumAtom } from '../../store/session';
import type { ToolContext } from '../types';

import { flightRiseAtom, propGhostAtom, type PropGhost } from './propState';

/** The flight's rise: as set, or up to the next level. */
export const flightRise = (ctx: ToolContext): number =>
  ctx.get(flightRiseAtom) ??
  riseToNextLevel(ctx.plan.getPlan(), ctx.get(workDatumAtom), getLibrary());

export const useFlightRise = (): number => {
  const set = useAtomValue(flightRiseAtom);
  const auto = riseToNextLevel(usePlan(), useAtomValue(workDatumAtom), getLibrary());
  return set ?? auto;
};

/**
 * What a click places for `ghost`, from `elevation`: a flight for stairs and ladders,
 * else the one prop.
 */
export const ghostSteps = (ghost: PropGhost, elevation: number, rise: number): FlightStep[] => {
  const start = { position: ghost.position, rotation: ghost.rotation, elevation };
  return ghost.def.flight ? flightSteps(ghost.def.flight, start, rise) : [start];
};

/** The ghost's pieces relative to the work datum (previews are lifted to it). */
export const useGhostSteps = (): FlightStep[] => {
  const ghost = useAtomValue(propGhostAtom);
  const rise = useFlightRise();
  return useMemo(() => (ghost ? ghostSteps(ghost, 0, rise) : []), [ghost, rise]);
};
