import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useState, type Ref } from 'react';
import {
  BoxGeometry,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Material,
} from 'three/webgpu';

import type { PieceBox } from '../../model/pieceBoxes';

import type { PieceColorer } from './pieceColors';

export interface PieceInstancesProps {
  boxes: readonly PieceBox[];
  colorOf: PieceColorer;
  material: Material;
  castShadow: boolean;
  ref?: Ref<InstancedMesh>;
}

const UP = new Vector3(0, 1, 0);

/** The boxes each mesh last drew, by instance index (for raycast hits). */
const drawn = new WeakMap<InstancedMesh, readonly PieceBox[]>();

/** The box an instance of `mesh` stands for, as of its last draw. */
export const boxOfInstance = (mesh: InstancedMesh, instanceId: number): PieceBox | undefined =>
  drawn.get(mesh)?.[instanceId];

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));

const createMesh = (material: Material, capacity: number): InstancedMesh => {
  // Its own unit box: disposing the geometry is what frees the instance buffers.
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), material, capacity);
  // Before the first render: the node graph is built once, with or without colours.
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  mesh.count = 0;
  return mesh;
};

const writeMatrices = (mesh: InstancedMesh, boxes: readonly PieceBox[]) => {
  const matrix = new Matrix4();
  const position = new Vector3();
  const turn = new Quaternion();
  const scale = new Vector3();
  boxes.forEach((box, i) => {
    position.set(box.center.x, box.center.y, box.center.z);
    turn.setFromAxisAngle(UP, box.rotationY);
    scale.set(box.size.x, box.size.y, box.size.z);
    mesh.setMatrixAt(i, matrix.compose(position, turn, scale));
  });
  mesh.count = boxes.length;
  mesh.visible = boxes.length > 0;
  mesh.instanceMatrix.needsUpdate = true;
  // Culling and raycasts use the bounds; they'd be stale otherwise.
  mesh.computeBoundingSphere();
  drawn.set(mesh, boxes);
};

const writeColors = (mesh: InstancedMesh, boxes: readonly PieceBox[], colorOf: PieceColorer) => {
  const color = new Color();
  boxes.forEach((box, i) => mesh.setColorAt(i, color.set(colorOf(box))));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
};

const Instances = ({
  capacity,
  boxes,
  colorOf,
  material,
  castShadow,
  ref,
}: PieceInstancesProps & { capacity: number }) => {
  const invalidate = useThree((s) => s.invalidate);
  const [mesh] = useState(() => createMesh(material, capacity));

  useLayoutEffect(() => {
    writeMatrices(mesh, boxes);
    invalidate();
  }, [mesh, boxes, invalidate]);

  useLayoutEffect(() => {
    writeColors(mesh, boxes, colorOf);
    invalidate();
  }, [mesh, boxes, colorOf, invalidate]);

  // The geometry and instance buffers are this mesh's own; the material is shared (and
  // `dispose={null}` keeps r3f off it).
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.dispose();
    },
    [mesh]
  );

  return <primitive object={mesh} ref={ref} castShadow={castShadow} receiveShadow dispose={null} />;
};

/**
 * Boxes as one instanced mesh (one draw call), coloured per instance. Its capacity is
 * the next power of two; crossing one remounts the mesh with new buffers.
 */
export const PieceInstances = (props: PieceInstancesProps) => {
  const capacity = nextPow2(props.boxes.length);
  return <Instances key={capacity} capacity={capacity} {...props} />;
};
