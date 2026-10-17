/**
 * Walks prefab hierarchies for snap points and collider corners, matching
 * `research/extract/extract_pieces.py`:
 * - the root's own transform is ignored (pieces are in their local space);
 * - snap points are GameObjects tagged 20000, active or not;
 * - colliders count only on active GameObjects, and not when they are triggers or
 *   disabled; mesh colliders whose mesh is in another bundle are skipped;
 * - children of inactive GameObjects are still walked.
 * `walkTransforms` (the hierarchy and each GameObject's matrix) is shared with
 * `renderParts.ts`, which skips inactive subtrees instead.
 */
import { check } from '../GameDataError';
import type { SerializedFile } from '../unity/serializedFile';
import {
  fields,
  flag,
  list,
  localRef,
  num,
  quat,
  readFields,
  vec3,
  type Fields,
  type V3,
} from '../unity/values';

const CLASS_TRANSFORM = 4;
const CLASS_RECT_TRANSFORM = 224;
const CLASS_MESH_COLLIDER = 64;
const CLASS_BOX_COLLIDER = 65;
const SNAP_TAG = 20000;

export interface PrefabShape {
  /** Snap points in the prefab's local space. */
  snaps: V3[];
  /** Corners of every counted collider's box, in the prefab's local space. */
  corners: V3[];
}

/** Row-major 4×4 matrix. */
export type Mat4 = readonly number[];

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const multiply = (a: Mat4, b: Mat4): Mat4 =>
  Array.from({ length: 16 }, (_, i) => {
    const row = i >> 2;
    const col = i & 3;
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += a[row * 4 + k]! * b[k * 4 + col]!;
    return sum;
  });

/** Translation · rotation · scale, as Unity composes a local transform. */
// prettier-ignore
const trs = (
  [px, py, pz]: V3,
  [x, y, z, w]: readonly [number, number, number, number],
  [sx, sy, sz]: V3
): Mat4 => [
  (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y - z * w) * sy, 2 * (x * z + y * w) * sz, px,
  2 * (x * y + z * w) * sx, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z - x * w) * sz, py,
  2 * (x * z - y * w) * sx, 2 * (y * z + x * w) * sy, (1 - 2 * (x * x + y * y)) * sz, pz,
  0, 0, 0, 1,
];

const transformPoint = (m: Mat4, [x, y, z]: V3): V3 => [
  m[0]! * x + m[1]! * y + m[2]! * z + m[3]!,
  m[4]! * x + m[5]! * y + m[6]! * z + m[7]!,
  m[8]! * x + m[9]! * y + m[10]! * z + m[11]!,
];

/** The 8 corners of a box, transformed by `m`. */
const boxCorners = (m: Mat4, [cx, cy, cz]: V3, [sx, sy, sz]: V3): V3[] => {
  const corners: V3[] = [];
  for (const dx of [-0.5, 0.5])
    for (const dy of [-0.5, 0.5])
      for (const dz of [-0.5, 0.5])
        corners.push(transformPoint(m, [cx + dx * sx, cy + dy * sy, cz + dz * sz]));
  return corners;
};

/** The axis-aligned bounds of `points`, or null when there are none. */
export const aabb = (points: readonly V3[]): [V3, V3] | null => {
  if (points.length === 0) return null;
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]!);
      max[i] = Math.max(max[i]!, p[i]!);
    }
  }
  return [min, max];
};

/** The component path IDs of a GameObject, in order. */
export const componentsOf = (go: Fields): bigint[] =>
  list(go.m_Component, 'GameObject.m_Component').flatMap((entry) => {
    const id = localRef(fields(entry, 'component').component, 'component');
    return id === null ? [] : [id];
  });

const transformOf = (file: SerializedFile, go: Fields): bigint => {
  const id = componentsOf(go).find((c) => {
    const classId = file.classId(c);
    return classId === CLASS_TRANSFORM || classId === CLASS_RECT_TRANSFORM;
  });
  check(id !== undefined, () => `GameObject ${String(go.m_Name)} has no transform`);
  return id;
};

interface Visit {
  root: bigint;
  transform: bigint;
  /** The parent node's index; -1 for a prefab root. */
  parent: number;
}

/** A GameObject of a prefab, with its matrix in prefab space. */
export interface TransformNode {
  /** The prefab root's GameObject. */
  root: bigint;
  go: bigint;
  matrix: Mat4;
  /** The parent's index in the walk's result (parents come first); -1 for a root. */
  parent: number;
}

/**
 * Transforms only, level by level: the hierarchy and every GameObject's matrix. A
 * transform seen twice (a cycle in corrupt `m_Children`) is an error, not a hang.
 */
export const walkTransforms = (
  file: SerializedFile,
  roots: readonly bigint[],
  onLevel: () => void = () => {}
): TransformNode[] => {
  const rootObjects = readFields(file, roots);
  let frontier: Visit[] = roots.map((root) => ({
    root,
    transform: transformOf(file, rootObjects.get(root)!),
    parent: -1,
  }));
  const nodes: TransformNode[] = [];
  const seen = new Set<bigint>();
  while (frontier.length > 0) {
    for (const { transform } of frontier) {
      check(!seen.has(transform), () => `transform ${transform} appears twice in a hierarchy`);
      seen.add(transform);
    }
    const transforms = readFields(
      file,
      frontier.map((v) => v.transform)
    );
    const next: Visit[] = [];
    for (const { root, transform, parent } of frontier) {
      const tr = transforms.get(transform)!;
      const local = trs(
        vec3(tr.m_LocalPosition, 'm_LocalPosition'),
        quat(tr.m_LocalRotation, 'm_LocalRotation'),
        vec3(tr.m_LocalScale, 'm_LocalScale')
      );
      // The root's own transform is ignored: pieces are in their local space.
      const matrix = parent < 0 ? IDENTITY : multiply(nodes[parent]!.matrix, local);
      const go = localRef(tr.m_GameObject, 'm_GameObject');
      check(go !== null, () => `transform ${transform} has no GameObject`);
      const index = nodes.push({ root, go, matrix, parent }) - 1;
      for (const child of list(tr.m_Children, 'm_Children')) {
        const id = localRef(child, 'm_Children');
        if (id !== null) next.push({ root, transform: id, parent: index });
      }
    }
    frontier = next;
    onLevel();
  }
  return nodes;
};

/** The box of a collider that counts, or null. */
const colliderBox = (
  file: SerializedFile,
  id: bigint,
  collider: Fields,
  meshes: ReadonlyMap<bigint, Fields>
): [center: V3, size: V3] | null => {
  if (flag(collider.m_IsTrigger, 'm_IsTrigger') || !flag(collider.m_Enabled, 'm_Enabled')) {
    return null;
  }
  if (file.classId(id) === CLASS_BOX_COLLIDER) {
    return [vec3(collider.m_Center, 'm_Center'), vec3(collider.m_Size, 'm_Size')];
  }
  // A mesh in another bundle is skipped, as the Python extract did.
  const meshId = localRef(collider.m_Mesh, 'm_Mesh');
  const mesh = meshId === null ? undefined : meshes.get(meshId);
  if (!mesh) return null;
  const bounds = fields(mesh.m_LocalAABB, 'm_LocalAABB');
  const [ex, ey, ez] = vec3(bounds.m_Extent, 'm_Extent');
  return [vec3(bounds.m_Center, 'm_Center'), [2 * ex, 2 * ey, 2 * ez]];
};

/**
 * Snap points and collider corners of each prefab in `roots`. The objects are spread
 * over the whole bundle, so reads are grouped to sweep it as few times as possible:
 * one sweep per hierarchy level for the transforms, then one each for every
 * GameObject, the colliders and their meshes.
 */
export const walkPrefabs = (
  file: SerializedFile,
  roots: readonly bigint[],
  onStep: () => void = () => {}
): Map<bigint, PrefabShape> => {
  const shapes = new Map<bigint, PrefabShape>(roots.map((id) => [id, { snaps: [], corners: [] }]));
  const nodes = walkTransforms(file, roots, onStep);

  const gameObjects = readFields(
    file,
    nodes.map((n) => n.go)
  );
  const colliderOwners: { node: TransformNode; id: bigint }[] = [];
  for (const node of nodes) {
    const go = gameObjects.get(node.go)!;
    if (num(go.m_Tag, 'm_Tag') === SNAP_TAG) {
      shapes.get(node.root)!.snaps.push([node.matrix[3]!, node.matrix[7]!, node.matrix[11]!]);
    }
    if (!flag(go.m_IsActive, 'm_IsActive')) continue;
    for (const id of componentsOf(go)) {
      const classId = file.classId(id);
      if (classId === CLASS_BOX_COLLIDER || classId === CLASS_MESH_COLLIDER) {
        colliderOwners.push({ node, id });
      }
    }
  }
  onStep();

  const colliders = readFields(
    file,
    colliderOwners.map((c) => c.id)
  );
  const meshIds = colliderOwners.flatMap(({ id }) => {
    const mesh =
      file.classId(id) === CLASS_MESH_COLLIDER
        ? localRef(colliders.get(id)!.m_Mesh, 'm_Mesh')
        : null;
    return mesh === null ? [] : [mesh];
  });
  const meshes = readFields(file, meshIds);
  for (const { node, id } of colliderOwners) {
    const box = colliderBox(file, id, colliders.get(id)!, meshes);
    if (box) shapes.get(node.root)!.corners.push(...boxCorners(node.matrix, ...box));
  }
  onStep();
  return shapes;
};
