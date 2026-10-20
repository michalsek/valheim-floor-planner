/** The armed stair's or ladder's flight: how high it climbs and its pieces. */
import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { flightSteps, riseToNextStop, type FlightStep } from '../../model/flight';
import { getStoreyStops, usePlan } from '../../store/planHooks';
import type { ToolContext } from '../types';

import { flightRiseAtom, propGhostAtom, type PropGhost } from './propState';

/** The flight's rise from `from`: as set, or up to the next storey's floor. */
export const flightRise = (ctx: ToolContext, from: number): number =>
  ctx.get(flightRiseAtom) ?? riseToNextStop(getStoreyStops(ctx.plan.getPlan()), from);

/** `flightRise` from the ghost's height (0 without a ghost). */
export const useFlightRise = (): number => {
  const set = useAtomValue(flightRiseAtom);
  const from = useAtomValue(propGhostAtom)?.elevation ?? 0;
  const auto = riseToNextStop(getStoreyStops(usePlan()), from);
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

/** The ghost's pieces, at their absolute heights. */
export const useGhostSteps = (): FlightStep[] => {
  const ghost = useAtomValue(propGhostAtom);
  const rise = useFlightRise();
  return useMemo(() => (ghost ? ghostSteps(ghost, ghost.elevation, rise) : []), [ghost, rise]);
};
