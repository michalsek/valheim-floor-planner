import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import {
  Box3,
  Euler,
  Matrix4,
  Quaternion,
  Sphere,
  Vector3,
  type InstancedBufferAttribute,
  type Mesh,
} from 'three/webgpu';

import type { PieceBox } from '../../model/pieceBoxes';

import { instanceMatrices } from './assets/gpuData';
import type { ModelResources, ReadyGroup, ReadyModel } from './assets/modelResources';
import { TINT_ATTRIBUTE } from './assets/realMaterial';
import type { PieceTinter } from './pieceColors';

interface GroupProps {
  resources: ModelResources;
  prefab: string;
  group: ReadyGroup;
  boxes: readonly PieceBox[];
  tintOf: PieceTinter;
}

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));

/** The model's own bounds (before instancing), kept from the first measure. */
const modelSphere = (mesh: Mesh): Sphere => {
  const data = mesh.userData as { modelSphere?: Sphere };
  data.modelSphere ??= mesh.geometry.boundingSphere?.clone() ?? new Sphere();
  return data.modelSphere;
};

/** Writes the instance matrices and the bounds around every instance (for culling). */
const writeMatrices = (mesh: Mesh, boxes: readonly PieceBox[]) => {
  const buffer = instanceMatrices(mesh.geometry);
  const matrix = new Matrix4();
  const position = new Vector3();
  const turn = new Quaternion();
  const euler = new Euler(0, 0, 0, 'YXZ');
  const own = modelSphere(mesh);
  const centres = new Box3();
  const centre = new Vector3();
  boxes.forEach((box, i) => {
    position.set(box.pivot.x, box.pivot.y, box.pivot.z);
    if (box.modelTurn)
      turn.setFromEuler(euler.set(box.modelTurn.x, box.modelTurn.y, box.modelTurn.z));
    else turn.setFromAxisAngle(UP, box.rotationY);
    matrix.compose(position, turn, ONE).toArray(buffer.array, i * 16);
    centres.expandByPoint(centre.copy(own.center).applyMatrix4(matrix));
  });
  buffer.needsUpdate = true;
  (mesh as Mesh & { count: number }).count = boxes.length;
  const bounds = (mesh.geometry.boundingSphere ??= new Sphere());
  centres.getBoundingSphere(bounds);
  bounds.radius += own.radius;
};

const writeTints = (mesh: Mesh, boxes: readonly PieceBox[], tintOf: PieceTinter) => {
  const tints = mesh.geometry.getAttribute(TINT_ATTRIBUTE) as InstancedBufferAttribute;
  boxes.forEach((box, i) => {
    const { color, amount } = tintOf(box);
    // sRGB, as written: the material mixes in sRGB.
    const rgb = parseInt(color.slice(1), 16);
    tints.setXYZW(
      i,
      ((rgb >> 16) & 255) / 255,
      ((rgb >> 8) & 255) / 255,
      (rgb & 255) / 255,
      amount
    );
  });
  tints.needsUpdate = true;
};

/** One model group drawn at every box (one draw call). */
const GroupInstances = ({ resources, prefab, group, boxes, tintOf }: GroupProps) => {
  const invalidate = useThree((s) => s.invalidate);
  const capacity = nextPow2(boxes.length);
  // From the pool: kept across 3D mounts, so its shader program stays linked.
  const mesh = useMemo(
    () => resources.mesh(prefab, group, capacity),
    [resources, prefab, group, capacity]
  );
  // A smaller mesh this one replaced is off the scene now.
  useEffect(() => resources.prune(), [resources, mesh]);

  useLayoutEffect(() => {
    writeMatrices(mesh, boxes);
    invalidate();
  }, [mesh, boxes, invalidate]);

  useLayoutEffect(() => {
    writeTints(mesh, boxes, tintOf);
    invalidate();
  }, [mesh, boxes, tintOf, invalidate]);

  return <primitive object={mesh} dispose={null} />;
};

export interface ModelInstancesProps {
  /** Boxes whose prefab has a ready model. */
  boxes: readonly PieceBox[];
  models: ReadonlyMap<string, ReadyModel>;
  resources: ModelResources;
  tintOf: PieceTinter;
}

/**
 * Real models at their boxes' pivots and turns: one instanced draw per prefab and
 * material group. Door and gate panels are drawn solid (only boxes are see-through).
 */
export const ModelInstances = ({ boxes, models, resources, tintOf }: ModelInstancesProps) => {
  const byPrefab = useMemo(() => {
    const groups = new Map<string, PieceBox[]>();
    for (const box of boxes) {
      if (box.prefab === null) continue;
      let list = groups.get(box.prefab);
      if (!list) groups.set(box.prefab, (list = []));
      list.push(box);
    }
    return groups;
  }, [boxes]);

  return [...byPrefab].flatMap(([prefab, list]) => {
    const model = models.get(prefab);
    if (!model) return [];
    return model.groups.map((group) => (
      <GroupInstances
        key={`${prefab}/${group.key}`}
        resources={resources}
        prefab={prefab}
        group={group}
        boxes={list}
        tintOf={tintOf}
      />
    ));
  });
};
