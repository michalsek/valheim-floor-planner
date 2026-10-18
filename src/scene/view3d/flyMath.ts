/**
 * Movement maths for the 3D view's fly mode (right mouse held + W/A/S/D/Q/E): which way
 * the held keys point, how fast, and a smooth, frame-rate independent velocity. Pure.
 */
import type { Vec3 } from '../../model/types';

export type FlyKey = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down';

/** By key position (`KeyboardEvent.code`), so AZERTY's Z/Q/S/D work the same. */
export const FLY_KEYS: Readonly<Record<string, FlyKey | undefined>> = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyE: 'up',
  KeyQ: 'down',
};

/** Base speed per metre of orbit distance when the hold starts (m/s per m). */
const SPEED_PER_METRE = 0.5;
/** Base speed limits (m/s): a brisk walk inside a house, a fast glide over a site. */
export const MIN_FLY_SPEED = 4;
export const MAX_FLY_SPEED = 40;
/** Shift held multiplies the speed by this. */
export const FAST_FACTOR = 4;
/** One wheel notch scales the speed by this; the scale stays within 1/8 … 8. */
const WHEEL_FACTOR = 1.25;
const MIN_SCALE = 1 / 8;
const MAX_SCALE = 8;
/** Pixels of wheel travel in one notch (line and page deltas count one notch each). */
const NOTCH_PX = 100;
/** How quickly the velocity reaches the keys' velocity (1/s): ~0.1 s to get most of the way. */
const RESPONSE = 12;
/** Below this (m/s) the velocity counts as stopped. */
const REST_SPEED = 0.01;

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

const axis = (held: ReadonlySet<FlyKey>, plus: FlyKey, minus: FlyKey): number =>
  (held.has(plus) ? 1 : 0) - (held.has(minus) ? 1 : 0);

const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

const scaled = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });

/**
 * The unit direction the held keys move in: W/S along the view direction (climbing or
 * sinking with it), A/D along the camera's level right, Q/E straight down/up. Zero when
 * nothing is held or opposite keys cancel; diagonals are no faster than straight lines.
 */
export const flyDirection = (held: ReadonlySet<FlyKey>, forward: Vec3, right: Vec3): Vec3 => {
  const f = axis(held, 'forward', 'back');
  const r = axis(held, 'right', 'left');
  const u = axis(held, 'up', 'down');
  const levelRight = Math.hypot(right.x, right.z);
  const rx = levelRight > 1e-6 ? right.x / levelRight : 0;
  const rz = levelRight > 1e-6 ? right.z / levelRight : 0;
  const sum = {
    x: forward.x * f + rx * r,
    y: forward.y * f + u,
    z: forward.z * f + rz * r,
  };
  const len = length(sum);
  return len > 1e-6 ? scaled(sum, 1 / len) : ZERO;
};

/**
 * The base speed (m/s) for a hold that starts `orbitDistance` from the orbit target:
 * close up it is slow enough for a room, far out fast enough to cross a site.
 */
export const baseFlySpeed = (orbitDistance: number): number =>
  Math.min(MAX_FLY_SPEED, Math.max(MIN_FLY_SPEED, orbitDistance * SPEED_PER_METRE));

/** The speed scale after a wheel event: wheel up (negative `deltaY`) is faster. */
export const wheelSpeedScale = (
  scale: number,
  e: Pick<WheelEvent, 'deltaY' | 'deltaMode'>
): number => {
  const notches = e.deltaMode === 0 ? e.deltaY / NOTCH_PX : Math.sign(e.deltaY);
  const next = scale * WHEEL_FACTOR ** -notches;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
};

/**
 * The velocity after `dt` seconds of easing towards `target`: the same path whatever the
 * frame rate. Snaps to rest once both are (almost) still.
 */
export const approachVelocity = (velocity: Vec3, target: Vec3, dt: number): Vec3 => {
  const k = 1 - Math.exp(-RESPONSE * dt);
  const next = {
    x: velocity.x + (target.x - velocity.x) * k,
    y: velocity.y + (target.y - velocity.y) * k,
    z: velocity.z + (target.z - velocity.z) * k,
  };
  return length(target) === 0 && length(next) < REST_SPEED ? ZERO : next;
};

export const isAtRest = (velocity: Vec3): boolean => length(velocity) === 0;

/** The target velocity: the keys' direction at the hold's speed (Shift: faster). */
export const flyVelocity = (direction: Vec3, speed: number, fast: boolean): Vec3 =>
  scaled(direction, speed * (fast ? FAST_FACTOR : 1));
