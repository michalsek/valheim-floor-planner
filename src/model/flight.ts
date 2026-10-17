/**
 * Stair and ladder flights: as many pieces as it takes to climb a rise, each one up
 * and along from the last. Pure.
 */
import type { Library } from '../catalog/library';
import type { PropDef } from '../catalog/propDefs';

import { roundElevation } from './elevation';
import { rotate } from './geometry/propGeometry';
import { levelAbove } from './levels';
import type { Plan, Prop, Vec2 } from './types';

/** A flight's rise when there is no level above to climb to (metres). */
export const DEFAULT_RISE = 2;

export type Flight = NonNullable<PropDef['flight']>;

export type FlightStep = Pick<Prop, 'position' | 'rotation' | 'elevation'>;

/** Pieces needed to climb `rise`: at least one. */
export const flightCount = (flight: Flight, rise: number): number =>
  Math.max(1, Math.ceil(rise / flight.rise - 1e-6));

/**
 * The pieces of a flight from `start` (the first piece) climbing `rise`. Stairs climb
 * along their local z (`flight.towards`), so piece i is i rises up and i runs along
 * that, turned with the piece.
 */
export const flightSteps = (flight: Flight, start: FlightStep, rise: number): FlightStep[] => {
  const up: Vec2 = rotate({ x: 0, z: flight.towards }, start.rotation);
  return Array.from({ length: flightCount(flight, rise) }, (_, i) => ({
    position: {
      x: start.position.x + up.x * flight.run * i,
      z: start.position.z + up.z * flight.run * i,
    },
    rotation: start.rotation,
    elevation: roundElevation(start.elevation + flight.rise * i),
  }));
};

/** How far up the next level above `elevation` is (`levelAbove`); `DEFAULT_RISE` with none. */
export const riseToNextLevel = (
  plan: Plan,
  elevation: number,
  lib: Pick<Library, 'propDefs'>
): number => {
  const next = levelAbove(plan, elevation, lib);
  return next === null ? DEFAULT_RISE : roundElevation(next - elevation);
};
