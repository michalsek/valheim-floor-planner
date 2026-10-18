/**
 * Fly mode for the 3D camera, as in an editor's scene view: while the right mouse button
 * is held on the canvas, W/A/S/D move along the view (forward climbs or sinks with it),
 * Q/E move straight down/up, Shift is faster and the wheel scales the speed.
 *
 * The right drag orbits as before until a movement key is pressed during the hold; from
 * then until the release it turns the view in place (first-person look): the orbit
 * controls still turn the camera, and `pin` puts the eye back where it was, moving the
 * target instead. Looking brings the target to `FLY_PIVOT` ahead (never further than it
 * was), so orbiting after a flight turns about a point nearby, and depth planes (which
 * follow the orbit distance) suit an interior.
 *
 * Keys are taken (in the capture phase, before the tools' window listeners) only while
 * the button is held; a key pressed during the hold stays taken until it is released,
 * so its auto-repeat never reaches a tool. The hold ends on the release, a lost button,
 * the window losing focus or the page being hidden.
 */
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Vector3, type PerspectiveCamera } from 'three/webgpu';

import type { Vec3 } from '../../model/types';

import {
  approachVelocity,
  baseFlySpeed,
  FLY_KEYS,
  flyDirection,
  flyVelocity,
  isAtRest,
  wheelSpeedScale,
  type FlyKey,
} from './flyMath';

/** The farthest ahead the orbit target sits while looking (metres). */
export const FLY_PIVOT = 5;
/** Longer frame gaps (a stall, the first frame after idling) count as this (seconds). */
const MAX_STEP = 0.1;
const RIGHT_BUTTON = 2;
const RIGHT_BUTTONS_BIT = 2;

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

interface Hold {
  pointerId: number;
  /** Shift / Ctrl / ⌘ at the press: the orbit controls pan, so the view is never pinned. */
  panning: boolean;
  /** Base speed for this hold (m/s), from the orbit distance at the press. */
  speed: number;
}

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const swallow = (e: Event) => {
  e.preventDefault();
  e.stopImmediatePropagation();
};

export const createFlyControls = (
  camera: PerspectiveCamera,
  controls: OrbitControls,
  /** The lowest the camera may go (the rig's safety floor). */
  floor: () => number
) => {
  let hold: Hold | null = null;
  let looking = false;
  /** The camera position while looking: the orbit controls' turns are undone around it. */
  const eye = new Vector3();
  /** The orbit distance while looking. */
  let pivot = FLY_PIVOT;
  const held = new Set<FlyKey>();
  /** Keys pressed during a hold, taken until released. */
  const taken = new Set<string>();
  let fast = false;
  let velocity: Vec3 = ZERO;
  /** The wheel's speed scale, kept for later holds while the view is open. */
  let speedScale = 1;
  let requestFrame = () => {};

  const startLook = () => {
    if (looking || !hold || hold.panning) return;
    looking = true;
    const dir = controls.target.clone().sub(camera.position);
    pivot = Math.min(dir.length(), FLY_PIVOT);
    eye.copy(camera.position);
    controls.target.copy(eye).addScaledVector(dir.normalize(), pivot);
    // Look follows the mouse directly; orbit damping would trail it.
    controls.enableDamping = false;
  };

  const end = () => {
    hold = null;
    held.clear();
    fast = false;
    if (looking) {
      looking = false;
      controls.enableDamping = true;
    }
  };

  /** Moves the camera, its target and the eye together, never below the floor. */
  const translate = (d: Vector3) => {
    const lift = Math.max(0, floor() - (camera.position.y + d.y));
    d.y += lift;
    camera.position.add(d);
    controls.target.add(d);
    eye.add(d);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== RIGHT_BUTTON || hold) return;
    hold = {
      pointerId: e.pointerId,
      panning: e.shiftKey || e.ctrlKey || e.metaKey,
      speed: baseFlySpeed(camera.position.distanceTo(controls.target)),
    };
    fast = e.shiftKey;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (hold?.pointerId !== e.pointerId) return;
    fast = e.shiftKey;
    // The release happened somewhere we never heard about.
    if ((e.buttons & RIGHT_BUTTONS_BIT) === 0) end();
  };

  const onPointerUp = (e: PointerEvent) => {
    if (
      hold?.pointerId === e.pointerId &&
      (e.type === 'pointercancel' || e.button === RIGHT_BUTTON)
    )
      end();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isEditable(e.target)) return;
    const key = FLY_KEYS[e.code];
    const plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (hold && plain && (key || e.key === 'Shift')) {
      swallow(e);
      fast = e.shiftKey;
      if (key) {
        held.add(key);
        taken.add(e.code);
        startLook();
        requestFrame();
      }
      return;
    }
    if (taken.has(e.code)) swallow(e);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const key = FLY_KEYS[e.code];
    if (key) held.delete(key);
    taken.delete(e.code);
    if (hold) fast = e.shiftKey;
  };

  const onWheel = (e: WheelEvent) => {
    if (!hold) return;
    // Before the tools (the Build ghost turns on the wheel) and the zoom.
    swallow(e);
    speedScale = wheelSpeedScale(speedScale, e);
  };

  const onLostFocus = () => {
    end();
    taken.clear();
  };
  const onVisibility = () => {
    if (document.hidden) onLostFocus();
  };

  return {
    /**
     * While looking, puts the eye back after the orbit controls turned the camera about
     * its target, and moves the target to the new view direction instead. Call after
     * every camera move, before anything reads the camera.
     */
    pin() {
      if (!looking) return;
      const dir = controls.target.clone().sub(camera.position).normalize();
      camera.position.copy(eye);
      controls.target.copy(eye).addScaledVector(dir, pivot);
      camera.lookAt(controls.target);
    },
    /** A placement (fit, reset, a dolly) while looking moves the eye with it. */
    sync() {
      if (!looking) return;
      eye.copy(camera.position);
      pivot = camera.position.distanceTo(controls.target);
    },
    /** Advances the movement by `dt` seconds; returns whether the camera moved. */
    step(dt: number): boolean {
      if (!hold && isAtRest(velocity)) return false;
      const step = Math.min(dt, MAX_STEP);
      const forward = controls.target.clone().sub(camera.position).normalize();
      const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const target = hold
        ? flyVelocity(flyDirection(held, forward, right), hold.speed * speedScale, fast)
        : ZERO;
      velocity = approachVelocity(velocity, target, step);
      if (isAtRest(velocity)) return false;
      translate(new Vector3(velocity.x, velocity.y, velocity.z).multiplyScalar(step));
      // Keep frames coming while moving (the canvas renders on demand).
      requestFrame();
      return true;
    },
    /** Listens on the canvas (presses) and the window (keys, wheel, releases, focus). */
    connect(canvas: HTMLElement, invalidate: () => void): () => void {
      requestFrame = invalidate;
      const capture = { capture: true } as const;
      const active = { capture: true, passive: false } as const;
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, capture);
      window.addEventListener('pointerup', onPointerUp, capture);
      window.addEventListener('pointercancel', onPointerUp, capture);
      window.addEventListener('keydown', onKeyDown, capture);
      window.addEventListener('keyup', onKeyUp, capture);
      window.addEventListener('wheel', onWheel, active);
      window.addEventListener('blur', onLostFocus);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        canvas.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove, capture);
        window.removeEventListener('pointerup', onPointerUp, capture);
        window.removeEventListener('pointercancel', onPointerUp, capture);
        window.removeEventListener('keydown', onKeyDown, capture);
        window.removeEventListener('keyup', onKeyUp, capture);
        window.removeEventListener('wheel', onWheel, active);
        window.removeEventListener('blur', onLostFocus);
        document.removeEventListener('visibilitychange', onVisibility);
        onLostFocus();
        velocity = ZERO;
        requestFrame = () => {};
      };
    },
  };
};

export type FlyControls = ReturnType<typeof createFlyControls>;
