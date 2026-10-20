import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useState } from 'react';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type Material,
} from 'three/webgpu';

import { SHAPE_TRIANGLES, type PieceShape } from '../../model/geometry/shapes';
import type { PieceBox } from '../../model/pieceBoxes';
import { useRelease } from '../useRelease';

import type { PieceColorer } from './pieceColors';

export interface PieceInstancesProps {
  boxes: readonly PieceBox[];
  /**
   * The boxes the meshes make room for (default `boxes`), a superset of `boxes`: while
   * it stays the same, showing fewer or more of them remounts nothing.
   */
  retain?: readonly PieceBox[] | undefined;
  colorOf: PieceColorer;
  /** For boxes (it may darken their edges). */
  material: Material;
  /** For the other shapes (roof corners, gable triangles); `material` without one. */
  shapeMaterial?: Material | undefined;
  castShadow: boolean;
  /** Room for at least this many boxes (default: the next power of two of the count). */
  capacity?: number | undefined;
}

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));

/** A shape's unit geometry: the unit box, or its triangles with flat normals. */
const shapeGeometry = (shape: PieceShape): BufferGeometry => {
  if (shape === 'box') return new BoxGeometry(1, 1, 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(SHAPE_TRIANGLES[shape], 3));
  geometry.computeVertexNormals();
  return geometry;
};

const createMesh = (shape: PieceShape, material: Material, capacity: number): InstancedMesh => {
  // Its own geometry: disposing it is what frees the instance buffers.
  const mesh = new InstancedMesh(shapeGeometry(shape), material, capacity);
  // Before the first render: the node graph is built once, with or without colours.
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  mesh.count = 0;
  return mesh;
};

const writeMatrices = (mesh: InstancedMesh, boxes: readonly PieceBox[]) => {
  const matrix = new Matrix4();
  const position = new Vector3();
  const euler = new Euler(0, 0, 0, 'YXZ');
  const turn = new Quaternion();
  const scale = new Vector3();
  boxes.forEach((box, i) => {
    position.set(box.center.x, box.center.y, box.center.z);
    turn.setFromEuler(euler.set(box.tiltX ?? 0, box.rotationY, box.rollZ ?? 0, 'YXZ'));
    scale.set(box.size.x, box.size.y, box.size.z);
    mesh.setMatrixAt(i, matrix.compose(position, turn, scale));
  });
  mesh.count = boxes.length;
  // An empty mesh (its boxes cut away) still draws, nothing, wherever the camera is: its
  // program links when the view opens, not on the cut step that first shows it.
  mesh.frustumCulled = boxes.length > 0;
  mesh.instanceMatrix.needsUpdate = true;
  // Culling uses the bounds; they'd be stale otherwise.
  mesh.computeBoundingSphere();
};

const writeColors = (mesh: InstancedMesh, boxes: readonly PieceBox[], colorOf: PieceColorer) => {
  const color = new Color();
  boxes.forEach((box, i) => mesh.setColorAt(i, color.set(colorOf(box))));
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
};

const disposeMesh = (mesh: InstancedMesh) => {
  mesh.geometry.dispose();
  mesh.dispose();
};

interface InstancesProps {
  shape: PieceShape;
  capacity: number;
  boxes: readonly PieceBox[];
  colorOf: PieceColorer;
  material: Material;
  castShadow: boolean;
}

const Instances = ({ shape, capacity, boxes, colorOf, material, castShadow }: InstancesProps) => {
  const invalidate = useThree((s) => s.invalidate);
  const [mesh] = useState(() => createMesh(shape, material, capacity));

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
  useRelease(mesh, disposeMesh);

  return <primitive object={mesh} castShadow={castShadow} receiveShadow dispose={null} />;
};

const byShape = (boxes: readonly PieceBox[]): Map<PieceShape, PieceBox[]> => {
  const groups = new Map<PieceShape, PieceBox[]>([['box', []]]);
  for (const box of boxes) {
    const shape = box.shape ?? 'box';
    let list = groups.get(shape);
    if (!list) groups.set(shape, (list = []));
    list.push(box);
  }
  return groups;
};

const NONE: readonly PieceBox[] = [];

/**
 * Boxes as instanced meshes, one per shape (one draw call each), coloured per instance
 * and turned (and tilted) as each box is. A mesh's capacity is a power of two at least
 * its shape's count in `retain` (and, for boxes, `capacity`); a change remounts it with
 * new buffers. A mesh stays mounted, empty, while none of its boxes are drawn.
 */
export const PieceInstances = ({
  capacity: min = 0,
  boxes,
  retain = boxes,
  material,
  shapeMaterial,
  ...props
}: PieceInstancesProps) => {
  const room = useMemo(() => byShape(retain), [retain]);
  const drawn = useMemo(() => (retain === boxes ? room : byShape(boxes)), [retain, boxes, room]);
  return [...room].map(([shape, list]) => {
    const capacity = nextPow2(Math.max(list.length, shape === 'box' ? min : 0));
    return (
      <Instances
        key={`${shape}:${capacity}`}
        shape={shape}
        capacity={capacity}
        boxes={drawn.get(shape) ?? NONE}
        material={shape === 'box' ? material : (shapeMaterial ?? material)}
        {...props}
      />
    );
  });
};
