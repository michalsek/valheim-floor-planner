import { useFrame, useThree } from '@react-three/fiber';
import { useAtomValue, useStore } from 'jotai';
import { useEffect, useEffectEvent, useLayoutEffect, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MathUtils, MOUSE, Vector3, type PerspectiveCamera } from 'three/webgpu';

import type { Bounds3 } from '../../model/geometry/bounds3';
import type { Vec3 } from '../../model/types';
import {
  modifiersAtom,
  projection3dAtom,
  viewportAtom,
  viewportSizeAtom,
  type SessionAccess,
} from '../../store/session';
import {
  orbitRequestAtom,
  orbitStateAtom,
  toolPressAtom,
  type OrbitRequestKind,
  type OrbitState,
} from '../../store/view3d';
import type { Projection3d } from '../../viewport/projection3d';
import type { Size } from '../../viewport/viewportMath';

import {
  along,
  boundsRadius,
  DEFAULT_DIR,
  frameBounds,
  frameWidth,
  type CameraPlacement,
} from './orbitMath';
import { fitClipPlanes, VIEW_FOV } from './useViewCamera';

/** Radius used for depth planes when the plan is empty. */
const EMPTY_RADIUS = 10;
/** The lowest the camera goes: just above the ground (the datum). */
const MIN_CAMERA_Y = 0.05;
/** How much one `+` / `−` press moves the camera in or out. */
const DOLLY_FACTOR = 1.25;
/**
 * The closest the camera orbits its target. Zooming in further pushes the camera and
 * the target forward together, so close-up steps never shrink to nothing.
 */
const MIN_ORBIT_DISTANCE = 2;
/** The smallest forward step when pushing through the orbit target. */
const MIN_PUSH_STEP = 0.75;
/** Pans move at least as fast as they would at this distance from the target. */
const PAN_FLOOR_DISTANCE = 6;

const createControls = (camera: PerspectiveCamera): OrbitControls => {
  const controls = new OrbitControls(camera);
  controls.enableDamping = true;
  controls.dampingFactor = 0.15;
  // Pans slide over the ground rather than across the screen.
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = MIN_ORBIT_DISTANCE;
  controls.maxDistance = 20_000;
  // Left acts (picking); right orbits (Shift/Ctrl/⌘ + right pans: built in); middle pans.
  controls.mouseButtons = { LEFT: null, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
  return controls;
};

/**
 * The camera and its controls, and the moves the rig makes, outside React. `onMove`
 * gets the camera as plain data after every move (and on `publish`).
 */
const createRig = (camera: PerspectiveCamera, onMove: (projection: Projection3d) => void) => {
  const controls = createControls(camera);
  let radius = EMPTY_RADIUS;
  let canvas: Size = { width: 1, height: 1 };

  /** The camera as plain data, for the cursor, picking and the 3D overlay. */
  const projection = (size: Size): Projection3d => {
    camera.updateMatrixWorld();
    const column = (i: number): Vec3 => {
      const { x, y, z } = new Vector3().setFromMatrixColumn(camera.matrixWorld, i);
      return { x, y, z };
    };
    const back = column(2);
    const { x, y, z } = camera.position;
    return {
      eye: { x, y, z },
      right: column(0),
      up: column(1),
      forward: { x: -back.x, y: -back.y, z: -back.z },
      tanHalfFov: Math.tan(MathUtils.degToRad(camera.fov) / 2),
      aspect: size.width / Math.max(size.height, 1),
      size: { width: size.width, height: size.height },
      orbitDistance: camera.position.distanceTo(controls.target),
    };
  };

  const publish = () => onMove(projection(canvas));

  /**
   * Keeps the camera above the ground (a pan or zoom to the cursor can take it lower
   * than the polar limit alone does) and fits the depth planes to the new distance.
   * Call after every camera move.
   */
  const afterMove = () => {
    if (camera.position.y < MIN_CAMERA_Y) camera.position.y = MIN_CAMERA_Y;
    const distance = camera.position.distanceTo(controls.target);
    // Pan speed scales with the distance to the target; keep a floor for close-ups.
    controls.panSpeed = Math.max(1, PAN_FLOOR_DISTANCE / Math.max(distance, 1e-3));
    fitClipPlanes(camera, distance, radius);
  };

  /** True when zooming in can't bring the camera any closer to its target. */
  const atMinDistance = () =>
    camera.position.distanceTo(controls.target) <= controls.minDistance + 1e-3;

  /**
   * Moves the camera and its target forward together, along the view direction (level
   * when the target would sink below the ground), by a step that never shrinks.
   */
  const pushThrough = () => {
    const forward = controls.target.clone().sub(camera.position).normalize();
    const step = Math.max(MIN_PUSH_STEP, camera.position.distanceTo(controls.target) * 0.25);
    if (controls.target.y + forward.y * step < 0) {
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) return;
      forward.normalize();
    }
    forward.multiplyScalar(step);
    const { x, y, z } = camera.position;
    const t = controls.target;
    place({
      position: { x: x + forward.x, y: y + forward.y, z: z + forward.z },
      target: { x: t.x + forward.x, y: t.y + forward.y, z: t.z + forward.z },
    });
  };

  const place = ({ position, target }: CameraPlacement) => {
    camera.position.set(position.x, position.y, position.z);
    controls.target.set(target.x, target.y, target.z);
    controls.update();
    afterMove();
    publish();
  };

  return {
    controls,
    afterMove,
    publish,
    place,
    setRadius(r: number) {
      radius = r;
    },
    /** The canvas size is part of the projection. */
    setSize(size: Size) {
      canvas = size;
      publish();
    },
    /** The default direction, keeping the target and distance. */
    reset() {
      const { x, y, z } = controls.target;
      const target = { x, y, z };
      place({ position: along(target, DEFAULT_DIR, camera.position.distanceTo(target)), target });
    },
    /**
     * Wheel zoom-in at the closest orbit distance pushes through instead (see
     * `pushThrough`). Returns whether it did, so the controls skip that wheel step.
     */
    wheelIn(): boolean {
      if (!atMinDistance()) return false;
      pushThrough();
      return true;
    },
    /** Moves the camera `factor` times closer to its target (within the distance limits). */
    dolly(factor: number) {
      if (factor > 1 && atMinDistance()) {
        pushThrough();
        return;
      }
      const offset = camera.position.clone().sub(controls.target);
      const distance = MathUtils.clamp(
        offset.length() / factor,
        controls.minDistance,
        controls.maxDistance
      );
      offset.setLength(distance);
      const { x, y, z } = controls.target;
      place({
        position: { x: x + offset.x, y: y + offset.y, z: z + offset.z },
        target: { x, y, z },
      });
    },
    /**
     * Ignores the press being dispatched (a tool's): the controls are off until the
     * event has reached every listener.
     */
    skipPress() {
      controls.enabled = false;
      setTimeout(() => {
        controls.enabled = true;
      });
    },
    /** Space held: left drag pans (as in 2D) instead of picking. */
    setPanOnLeft(pan: boolean) {
      controls.mouseButtons.LEFT = pan ? MOUSE.PAN : null;
    },
    snapshot(): OrbitState {
      const { x, y, z } = camera.position;
      const t = controls.target;
      return { position: { x, y, z }, target: { x: t.x, y: t.y, z: t.z } };
    },
  };
};

/** Frames what the 2D view shows: its centre, and its visible width. */
const frame2dView = (session: SessionAccess, aspect: number): CameraPlacement => {
  const { center, zoom } = session.get(viewportAtom);
  const width = session.get(viewportSizeAtom).width / zoom;
  return frameWidth({ x: center.x, y: 0, z: center.z }, width, VIEW_FOV, aspect, DEFAULT_DIR);
};

/**
 * Orbit controls on the canvas for the 3D camera: damped orbit, ground pan and zoom
 * to the cursor. Answers fit, reset and dolly requests, keeps the camera for the next
 * time 3D opens (the first time, it fits the plan), and publishes it as
 * `projection3dAtom` after every move and resize.
 */
export const OrbitRig = ({
  camera,
  bounds,
}: {
  camera: PerspectiveCamera;
  bounds: Bounds3 | null;
}) => {
  const store = useStore();
  const gl = useThree((s) => s.gl);
  const setThree = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  // Each move publishes the camera and asks for a frame, so the overlay redraws with
  // the camera the frame is drawn with.
  const [rig] = useState(() =>
    createRig(camera, (projection) => {
      store.set(projection3dAtom, projection);
      invalidate();
    })
  );
  const request = useAtomValue(orbitRequestAtom);
  /** Requests up to this one were made before this mount (in 2D, say); they're ignored. */
  const [firstRequest] = useState(() => store.get(orbitRequestAtom)?.n ?? 0);

  useLayoutEffect(() => {
    rig.setRadius(bounds ? boundsRadius(bounds) : EMPTY_RADIUS);
  }, [rig, bounds]);

  // Before the mount effect below, so the first placement is published at this size.
  useLayoutEffect(() => {
    rig.setSize(size);
  }, [rig, size]);

  /** Frames the plan as of this render; an empty plan frames what the 2D view showed. */
  const fit = useEffectEvent(() => {
    const aspect = size.width / Math.max(size.height, 1);
    rig.place(
      bounds ? frameBounds(bounds, VIEW_FOV, aspect, DEFAULT_DIR) : frame2dView(store, aspect)
    );
  });

  // Mount: come back to the saved camera, or fit; unmount: save it.
  useLayoutEffect(() => {
    const saved = store.get(orbitStateAtom);
    if (saved) rig.place(saved);
    else fit();
    return () => store.set(orbitStateAtom, rig.snapshot());
  }, [rig, store]);

  // Requests are handled after the render they arrive in, so a fit after Open or New
  // sees the new plan's bounds (both updates land in the same render).
  useLayoutEffect(() => {
    if (!request || request.n <= firstRequest) return;
    const handlers: Record<OrbitRequestKind, () => void> = {
      fit,
      reset: () => rig.reset(),
      dollyIn: () => rig.dolly(DOLLY_FACTOR),
      dollyOut: () => rig.dolly(1 / DOLLY_FACTOR),
    };
    handlers[request.kind]();
  }, [request, firstRequest, rig]);

  useLayoutEffect(() => () => store.set(projection3dAtom, null), [store]);

  useEffect(() => {
    const { controls } = rig;
    const onChange = () => {
      rig.afterMove();
      rig.publish();
    };
    const applyButtons = () => rig.setPanOnLeft(store.get(modifiersAtom).space);
    applyButtons();
    // Capture phase: runs before the controls' own wheel listener on the canvas.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY >= 0 || !rig.wheelIn()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    gl.domElement.addEventListener('wheel', onWheel, { capture: true, passive: false });
    controls.connect(gl.domElement);
    controls.addEventListener('change', onChange);
    // Published so the ground can follow the orbit target.
    setThree({ controls });
    const stopButtons = store.sub(modifiersAtom, applyButtons);
    const stopPresses = store.sub(toolPressAtom, () => rig.skipPress());
    return () => {
      stopButtons();
      stopPresses();
      gl.domElement.removeEventListener('wheel', onWheel, { capture: true });
      controls.removeEventListener('change', onChange);
      controls.disconnect();
      setThree({ controls: null });
    };
  }, [rig, gl, store, setThree]);

  // Damping: `update` fires `change` (and so another frame) until the motion settles.
  useFrame(() => {
    rig.controls.update();
  });

  return null;
};
