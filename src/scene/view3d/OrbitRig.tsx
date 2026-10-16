import { useFrame, useThree } from '@react-three/fiber';
import { useAtomValue, useStore } from 'jotai';
import { useEffect, useEffectEvent, useLayoutEffect, useState } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MOUSE, type PerspectiveCamera } from 'three/webgpu';

import {
  modifiersAtom,
  viewportAtom,
  viewportSizeAtom,
  type SessionAccess,
} from '../../store/session';
import { orbitRequestAtom, orbitStateAtom, type OrbitState } from '../../store/view3d';

import type { Bounds3 } from '../../model/geometry/bounds3';

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

const createControls = (camera: PerspectiveCamera): OrbitControls => {
  const controls = new OrbitControls(camera);
  controls.enableDamping = true;
  controls.dampingFactor = 0.15;
  // Pans slide over the ground rather than across the screen.
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 0.5;
  controls.maxDistance = 20_000;
  // Left acts (picking); right orbits (Shift/Ctrl/⌘ + right pans: built in); middle pans.
  controls.mouseButtons = { LEFT: null, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
  return controls;
};

/** The camera and its controls, and the moves the rig makes, outside React. */
const createRig = (camera: PerspectiveCamera, onMove: () => void) => {
  const controls = createControls(camera);
  let radius = EMPTY_RADIUS;

  /**
   * Keeps the camera above the ground (a pan or zoom to the cursor can take it lower
   * than the polar limit alone does) and fits the depth planes to the new distance.
   * Call after every camera move.
   */
  const afterMove = () => {
    if (camera.position.y < MIN_CAMERA_Y) camera.position.y = MIN_CAMERA_Y;
    fitClipPlanes(camera, camera.position.distanceTo(controls.target), radius);
  };

  const place = ({ position, target }: CameraPlacement) => {
    camera.position.set(position.x, position.y, position.z);
    controls.target.set(target.x, target.y, target.z);
    controls.update();
    afterMove();
    onMove();
  };

  return {
    controls,
    afterMove,
    place,
    setRadius(r: number) {
      radius = r;
    },
    /** The default direction, keeping the target and distance. */
    reset() {
      const { x, y, z } = controls.target;
      const target = { x, y, z };
      place({ position: along(target, DEFAULT_DIR, camera.position.distanceTo(target)), target });
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
 * to the cursor. Answers fit and reset requests, and keeps the camera for the next time
 * 3D opens (the first time, it fits the plan).
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
  const [rig] = useState(() => createRig(camera, invalidate));
  const request = useAtomValue(orbitRequestAtom);
  /** Requests up to this one were made before this mount (in 2D, say); they're ignored. */
  const [firstRequest] = useState(() => store.get(orbitRequestAtom)?.n ?? 0);

  useLayoutEffect(() => {
    rig.setRadius(bounds ? boundsRadius(bounds) : EMPTY_RADIUS);
  }, [rig, bounds]);

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
    if (request.kind === 'fit') fit();
    if (request.kind === 'reset') rig.reset();
  }, [request, firstRequest, rig]);

  useEffect(() => {
    const { controls } = rig;
    const onChange = () => {
      rig.afterMove();
      invalidate();
    };
    const applyButtons = () => rig.setPanOnLeft(store.get(modifiersAtom).space);
    applyButtons();
    controls.connect(gl.domElement);
    controls.addEventListener('change', onChange);
    // Published so the ground (and picking) can follow the camera.
    setThree({ controls });
    const stopButtons = store.sub(modifiersAtom, applyButtons);
    return () => {
      stopButtons();
      controls.removeEventListener('change', onChange);
      controls.disconnect();
      setThree({ controls: null });
    };
  }, [rig, gl, store, invalidate, setThree]);

  // Damping: `update` fires `change` (and so another frame) until the motion settles.
  useFrame(() => {
    rig.controls.update();
  });

  return null;
};
