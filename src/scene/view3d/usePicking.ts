import { useThree } from '@react-three/fiber';
import { useStore } from 'jotai';
import { useEffect, type RefObject } from 'react';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Raycaster, Vector2, type InstancedMesh } from 'three/webgpu';

import type { PieceBox } from '../../model/pieceBoxes';
import { toggleItem } from '../../model/selection';
import { hoverAtom, selectionAtom } from '../../store/selection';
import { cursorStyleAtom, modifiersAtom } from '../../store/session';
import { PRIMARY_BUTTON } from '../../tools/pointerButtons';

import { boxOfInstance } from './PieceInstances';

/** A press that moves further than this (CSS px) is a drag, not a click. */
const CLICK_SLOP_PX = 4;

/**
 * Click and hover picking in 3D, by raycast against the piece meshes. A click (a
 * left press that barely moves) selects what is under it: Shift toggles it, a plain
 * click replaces the selection, a miss clears it. Moving with no button held sets the
 * hover, as the 2D hit test would; so does a camera move under a still pointer (fit,
 * reset, damping).
 */
export const usePicking = (meshes: readonly RefObject<InstancedMesh | null>[]): void => {
  const store = useStore();
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  // `OrbitRig` registers its controls with r3f.
  const controls = useThree((s) => s.controls) as OrbitControls | null;

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let press: { id: number; x: number; y: number } | null = null;
    let hoverKey: string | null = null;
    /** The pointer over the canvas, while no button is held. */
    let idlePointer: { clientX: number; clientY: number } | null = null;

    const pick = (e: { clientX: number; clientY: number }): PieceBox | null => {
      const rect = canvas.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, get().camera);
      const targets = meshes.flatMap((m) => (m.current?.visible ? [m.current] : []));
      for (const hit of raycaster.intersectObjects(targets, false)) {
        const box =
          hit.instanceId === undefined
            ? undefined
            : boxOfInstance(hit.object as InstancedMesh, hit.instanceId);
        if (box) return box;
      }
      return null;
    };

    const setHover = (box: PieceBox | null) => {
      const key = box?.key ?? null;
      if (key === hoverKey) return;
      hoverKey = key;
      store.set(hoverAtom, box?.hit ?? null);
      store.set(cursorStyleAtom, box ? 'pointer' : null);
    };

    const onDown = (e: PointerEvent) => {
      idlePointer = null;
      const panning = store.get(modifiersAtom).space;
      press =
        e.button === PRIMARY_BUTTON && !panning
          ? { id: e.pointerId, x: e.clientX, y: e.clientY }
          : null;
    };

    const onUp = (e: PointerEvent) => {
      if (e.buttons === 0) idlePointer = e;
      const box = pick(e);
      // Hover isn't tracked during a drag (an orbit moves everything under the pointer).
      setHover(box);
      if (!press || press.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y);
      press = null;
      if (moved > CLICK_SLOP_PX) return;
      const selection = store.get(selectionAtom);
      if (!box) store.set(selectionAtom, []);
      else store.set(selectionAtom, e.shiftKey ? toggleItem(selection, box.item) : [box.item]);
    };

    const onMove = (e: PointerEvent) => {
      if (e.buttons !== 0) return;
      idlePointer = e;
      setHover(pick(e));
    };

    const onLeave = () => {
      idlePointer = null;
      setHover(null);
    };

    const onCameraMove = () => {
      if (idlePointer) setHover(pick(idlePointer));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    controls?.addEventListener('change', onCameraMove);
    return () => {
      controls?.removeEventListener('change', onCameraMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      setHover(null);
    };
  }, [gl, get, store, meshes, controls]);
};
