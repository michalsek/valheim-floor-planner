/**
 * The Build ghost as real models (M17 §2.5): each prefab's groups drawn with the shared
 * model materials (one more instanced mesh each, tinted per instance), so a ghost adds
 * no shader programs or pipelines. Meshes are kept for the recently armed prefabs
 * (`kept`, whose models the view keeps loaded), so switching between them builds
 * nothing; a prefab whose model isn't ready is drawn as a ghost box.
 */
import { useThree } from '@react-three/fiber';
import { useAtomValue } from 'jotai';
import { useLayoutEffect, useMemo } from 'react';
import {
  Euler,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type InstancedBufferAttribute,
} from 'three/webgpu';

import type { PieceBox } from '../../model/pieceBoxes';
import { rawBox } from '../../model/rawBoxes';
import type { RawShapeLib } from '../../model/rawShapes';
import { modelLoadAtom } from '../../store/modelView';
import { useRelease } from '../useRelease';

import { createInstancedGeometry, instanceMatrices } from './assets/gpuData';
import type { ReadyModel } from './assets/modelResources';
import { TINT_ATTRIBUTE } from './assets/realMaterial';
import { useModelResources } from './assets/useModels';
import { GhostBoxes } from './GhostBoxes';
import type { PieceColorer, PieceTinter } from './pieceColors';

const UP = new Vector3(0, 1, 0);
const ONE = new Vector3(1, 1, 1);

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));

const createMeshes = (model: ReadyModel, capacity: number): Mesh[] =>
  model.groups.map((group) => {
    const mesh = new Mesh(createInstancedGeometry(group.geometry, capacity), group.material);
    (mesh as Mesh & { count: number }).count = 0;
    // As the plan's model meshes (same pipeline), but casting no shadow.
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  });

const disposeMeshes = (meshes: Mesh[]) =>
  meshes.forEach((mesh) => (mesh.geometry as BufferGeometry).dispose());

const writeInstances = (mesh: Mesh, boxes: readonly PieceBox[], tintOf: PieceTinter) => {
  const matrices = instanceMatrices(mesh.geometry);
  const tints = mesh.geometry.getAttribute(TINT_ATTRIBUTE) as InstancedBufferAttribute;
  const matrix = new Matrix4();
  const position = new Vector3();
  const turn = new Quaternion();
  const euler = new Euler(0, 0, 0, 'YXZ');
  boxes.forEach((box, i) => {
    position.set(box.pivot.x, box.pivot.y, box.pivot.z);
    if (box.modelTurn)
      turn.setFromEuler(euler.set(box.modelTurn.x, box.modelTurn.y, box.modelTurn.z));
    else turn.setFromAxisAngle(UP, box.rotationY);
    matrix.compose(position, turn, ONE).toArray(matrices.array, i * 16);
    const { color, amount } = tintOf(box);
    const rgb = parseInt(color.slice(1), 16);
    tints.setXYZW(
      i,
      ((rgb >> 16) & 255) / 255,
      ((rgb >> 8) & 255) / 255,
      (rgb & 255) / 255,
      amount
    );
  });
  matrices.needsUpdate = true;
  tints.needsUpdate = true;
  (mesh as Mesh & { count: number }).count = boxes.length;
  mesh.visible = boxes.length > 0;
};

interface PrefabGhostProps {
  model: ReadyModel;
  capacity: number;
  boxes: readonly PieceBox[];
  tintOf: PieceTinter;
}

/** One prefab's model groups at its ghost boxes (none: mounted, hidden). */
const PrefabGhost = ({ model, capacity, boxes, tintOf }: PrefabGhostProps) => {
  const invalidate = useThree((s) => s.invalidate);
  const meshes = useMemo(() => createMeshes(model, capacity), [model, capacity]);
  useRelease(meshes, disposeMeshes);
  useLayoutEffect(() => {
    meshes.forEach((mesh) => writeInstances(mesh, boxes, tintOf));
    invalidate();
  }, [meshes, boxes, tintOf, invalidate]);
  return meshes.map((mesh, i) => <primitive key={i} object={mesh} dispose={null} />);
};

const NONE: readonly PieceBox[] = [];

interface GhostModelProps {
  /** The ghost's boxes (absolute heights); empty while there is no ghost. */
  boxes: readonly PieceBox[];
  /** Prefabs whose meshes stay mounted (the view keeps their models loaded). */
  kept: readonly string[];
  tintOf: PieceTinter;
  /** For the boxes drawn while their model loads. */
  colorOf: PieceColorer;
}

export const GhostModel = ({ boxes, kept, tintOf, colorOf }: GhostModelProps) => {
  const resources = useModelResources();
  // Re-read the resources whenever a model arrives.
  useAtomValue(modelLoadAtom);
  const byPrefab = new Map<string, PieceBox[]>();
  for (const box of boxes) {
    if (box.prefab !== null) byPrefab.set(box.prefab, [...(byPrefab.get(box.prefab) ?? []), box]);
  }
  const prefabs = [...new Set([...kept, ...byPrefab.keys()])];
  const ready = new Map<string, ReadyModel>();
  for (const prefab of prefabs) {
    const model = resources.peek(prefab);
    if (model) ready.set(prefab, model);
  }
  const loading = boxes.some((box) => box.prefab === null || !ready.has(box.prefab))
    ? boxes.filter((box) => box.prefab === null || !ready.has(box.prefab))
    : NONE;
  return (
    <>
      {[...ready].map(([prefab, model]) => {
        const list = byPrefab.get(prefab) ?? NONE;
        const capacity = nextPow2(list.length);
        return (
          <PrefabGhost
            key={`${prefab}:${capacity}`}
            model={model}
            capacity={capacity}
            boxes={list}
            tintOf={tintOf}
          />
        );
      })}
      <GhostBoxes boxes={loading} colorOf={colorOf} />
    </>
  );
};

const keptBoxes = new WeakMap<readonly PieceBox[], { key: string; boxes: readonly PieceBox[] }>();

/**
 * `retainBoxes` plus a stand-in box for each kept prefab the plan doesn't use, so the
 * plan's `useModels` keeps the ghost's models loaded (it frees every prefab it isn't
 * given) and mounts their (empty) meshes, which links their programs up front.
 */
export const withKeptPrefabs = (
  retainBoxes: readonly PieceBox[],
  kept: readonly string[],
  lib: RawShapeLib
): readonly PieceBox[] => {
  const used = new Set(retainBoxes.map((box) => box.prefab));
  const missing = kept.filter((prefab) => !used.has(prefab));
  if (missing.length === 0) return retainBoxes;
  const key = missing.join('\n');
  const cached = keptBoxes.get(retainBoxes);
  if (cached?.key === key) return cached.boxes;
  const stand = missing.map((prefab, i) =>
    rawBox(
      {
        id: `ghostKept${i}`,
        prefab,
        position: { x: 0, y: 0, z: 0 },
        rotation: { yaw: 0, pitch: 0, roll: 0 },
      },
      lib
    )
  );
  const boxes = [...retainBoxes, ...stand];
  keptBoxes.set(retainBoxes, { key, boxes });
  return boxes;
};
