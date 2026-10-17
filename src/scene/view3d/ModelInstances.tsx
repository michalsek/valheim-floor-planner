import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Color,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
  type InstancedBufferAttribute,
  type Material,
} from 'three/webgpu';

import type { Geometry } from '../../gameData/valheim/bakeModel';
import type { PieceBox } from '../../model/pieceBoxes';

import { createInstancedGeometry } from './assets/gpuData';
import type { ReadyModel } from './assets/modelResources';
import { TINT_ATTRIBUTE } from './assets/realMaterial';
import type { PieceTinter } from './pieceColors';

interface GroupProps {
  geometry: Geometry;
  material: Material;
  boxes: readonly PieceBox[];
  tintOf: PieceTinter;
  castShadow: boolean;
}

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));

const writeMatrices = (mesh: InstancedMesh, boxes: readonly PieceBox[]) => {
  const matrix = new Matrix4();
  const position = new Vector3();
  const turn = new Quaternion();
  boxes.forEach((box, i) => {
    position.set(box.pivot.x, box.pivot.y, box.pivot.z);
    turn.setFromAxisAngle(UP, box.rotationY);
    mesh.setMatrixAt(i, matrix.compose(position, turn, ONE));
  });
  mesh.count = boxes.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
};

const writeTints = (mesh: InstancedMesh, boxes: readonly PieceBox[], tintOf: PieceTinter) => {
  const tints = mesh.geometry.getAttribute(TINT_ATTRIBUTE) as InstancedBufferAttribute;
  const color = new Color();
  boxes.forEach((box, i) => {
    const { color: hex, amount } = tintOf(box);
    color.set(hex);
    tints.setXYZW(i, color.r, color.g, color.b, amount);
  });
  tints.needsUpdate = true;
};

/** One model group drawn at every box (one draw call), with room for `capacity`. */
const GroupInstances = ({
  capacity,
  geometry,
  material,
  boxes,
  tintOf,
  castShadow,
}: GroupProps & { capacity: number }) => {
  const invalidate = useThree((s) => s.invalidate);
  const [mesh] = useState(
    () => new InstancedMesh(createInstancedGeometry(geometry, capacity), material, capacity)
  );

  useLayoutEffect(() => {
    writeMatrices(mesh, boxes);
    invalidate();
  }, [mesh, boxes, invalidate]);

  useLayoutEffect(() => {
    writeTints(mesh, boxes, tintOf);
    invalidate();
  }, [mesh, boxes, tintOf, invalidate]);

  // The geometry is this mesh's own; the material is shared (`modelResources`).
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.dispose();
    },
    [mesh]
  );

  return <primitive object={mesh} castShadow={castShadow} receiveShadow dispose={null} />;
};

const Group = (props: GroupProps) => {
  const capacity = nextPow2(props.boxes.length);
  return <GroupInstances key={capacity} capacity={capacity} {...props} />;
};

export interface ModelInstancesProps {
  /** Boxes whose prefab has a ready model. */
  boxes: readonly PieceBox[];
  models: ReadonlyMap<string, ReadyModel>;
  tintOf: PieceTinter;
}

/**
 * Real models at their boxes' pivots and turns: one instanced draw per prefab and
 * material group, door and gate panels see-through (and casting no shadow), as boxes.
 */
export const ModelInstances = ({ boxes, models, tintOf }: ModelInstancesProps) => {
  const byPrefab = useMemo(() => {
    const groups = new Map<string, { solid: PieceBox[]; panels: PieceBox[] }>();
    for (const box of boxes) {
      if (box.prefab === null) continue;
      let entry = groups.get(box.prefab);
      if (!entry) groups.set(box.prefab, (entry = { solid: [], panels: [] }));
      (box.kind === 'opening' ? entry.panels : entry.solid).push(box);
    }
    return groups;
  }, [boxes]);

  return [...byPrefab].flatMap(([prefab, { solid, panels }]) => {
    const model = models.get(prefab);
    if (!model) return [];
    return model.groups.flatMap((group) => [
      solid.length > 0 && (
        <Group
          key={`${prefab}/${group.key}/solid`}
          geometry={group.geometry}
          material={group.solid}
          boxes={solid}
          tintOf={tintOf}
          castShadow
        />
      ),
      panels.length > 0 && (
        <Group
          key={`${prefab}/${group.key}/panel`}
          geometry={group.geometry}
          material={group.panel}
          boxes={panels}
          tintOf={tintOf}
          castShadow={false}
        />
      ),
    ]);
  });
};
