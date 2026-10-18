import { useThree } from '@react-three/fiber';
import { useEffect, type RefObject } from 'react';
import type { Object3D, WebGPURenderer } from 'three/webgpu';

/**
 * Compiles the pipelines (programs on WebGL) of the hidden meshes under `root` ahead of
 * their first draw, so showing them later (a slider leaving 1) creates none and costs no
 * frame. They are shown only for the synchronous part of `compileAsync`, which collects
 * what to compile; the compiling itself runs in the background. Again when `key` changes
 * (new geometry finds the same pipelines).
 */
export const usePrewarm = (root: RefObject<Object3D | null>, key: unknown): void => {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const group = root.current;
    if (!group) return;
    const hidden: Object3D[] = [];
    group.traverse((object) => {
      if (!object.visible) hidden.push(object);
    });
    if (hidden.length === 0) return;
    hidden.forEach((object) => (object.visible = true));
    gl.compileAsync(group, camera, scene).catch(() => {});
    hidden.forEach((object) => (object.visible = false));
  }, [gl, scene, camera, root, key]);
};
