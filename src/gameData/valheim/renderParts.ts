/**
 * What a piece draws: its mesh renderers in prefab space. The rule (M14's probe):
 * - only the active subtree counts: an inactive GameObject hides its children (the
 *   `Worn` / `Broken` states, `*_snow` variants, the disabled source planks);
 * - only enabled MeshRenderers with a MeshFilter (skinned sails, particles and lights
 *   are skipped);
 * - each LODGroup shows its first level with a drawable renderer: LOD0, unless LOD0 is
 *   all skinned meshes (the blast furnace, artisan table, spinning wheel), then LOD1.
 *   Renderers listed only in other levels (`largelod`) are dropped; one listed in LOD0
 *   and LOD1 (the forge and other stations) stays.
 * Meshes are local, or Unity built-ins from `unity default resources`.
 */
import type { SerializedFile } from '../unity/serializedFile';
import { fields, flag, list, localRef, pptr, readFields, type Fields } from '../unity/values';

import { componentsOf, walkTransforms, type Mat4, type TransformNode } from './hierarchy';

const CLASS_MESH_RENDERER = 23;
const CLASS_MESH_FILTER = 33;
const CLASS_LOD_GROUP = 205;
const BUILTIN_RESOURCES = 'unity default resources';

/** A mesh in the bundle (its path ID), or a Unity built-in (its path ID there). */
export type MeshRef = bigint | { builtin: number };

export interface RenderPart {
  mesh: MeshRef;
  /** Prefab space (the root's own transform ignored). */
  matrix: Mat4;
  /** Material per submesh; null where it is in another file. */
  materials: (bigint | null)[];
}

interface Owned {
  node: TransformNode;
  renderer: bigint;
  filter: bigint;
}

/** Whether each node is active: itself and every ancestor (parents come first). */
const activeNodes = (nodes: readonly TransformNode[], gameObjects: ReadonlyMap<bigint, Fields>) => {
  const active: boolean[] = [];
  nodes.forEach((node, i) => {
    const own = flag(gameObjects.get(node.go)!.m_IsActive, 'm_IsActive');
    active[i] = own && (node.parent < 0 || active[node.parent]!);
  });
  return active;
};

/** Renderers in LOD levels a LODGroup doesn't show (see the rule above). */
const lodDropped = (lodGroups: Iterable<Fields>, drawable: ReadonlySet<bigint>): Set<bigint> => {
  const dropped = new Set<bigint>();
  for (const group of lodGroups) {
    const levels = list(group.m_LODs, 'm_LODs').map((lod) =>
      list(fields(lod, 'LOD').renderers, 'renderers').flatMap((entry) => {
        const id = localRef(fields(entry, 'LODRenderer').renderer, 'renderer');
        return id === null ? [] : [id];
      })
    );
    const shown = new Set(levels.find((level) => level.some((id) => drawable.has(id))) ?? []);
    for (const id of levels.flat()) if (!shown.has(id)) dropped.add(id);
  }
  return dropped;
};

const meshRef = (file: SerializedFile, filter: Fields): MeshRef | null => {
  const { fileId, pathId } = pptr(filter.m_Mesh, 'm_Mesh');
  if (pathId === 0n) return null;
  if (fileId === 0) return pathId;
  const external = file.externals[fileId - 1] ?? '';
  return external.endsWith(BUILTIN_RESOURCES) ? { builtin: Number(pathId) } : null;
};

/** The render parts of each prefab in `roots` (by root GameObject). */
export const renderParts = (
  file: SerializedFile,
  roots: readonly bigint[],
  onStep: () => void = () => {}
): Map<bigint, RenderPart[]> => {
  const nodes = walkTransforms(file, roots, onStep);
  const gameObjects = readFields(
    file,
    nodes.map((n) => n.go)
  );
  const active = activeNodes(nodes, gameObjects);

  const owned: Owned[] = [];
  const lodGroupIds: bigint[] = [];
  nodes.forEach((node, i) => {
    if (!active[i]) return;
    const components = componentsOf(gameObjects.get(node.go)!);
    const ofClass = (classId: number) => components.filter((c) => file.classId(c) === classId);
    lodGroupIds.push(...ofClass(CLASS_LOD_GROUP));
    const [filter] = ofClass(CLASS_MESH_FILTER);
    const [renderer] = ofClass(CLASS_MESH_RENDERER);
    if (filter !== undefined && renderer !== undefined) owned.push({ node, renderer, filter });
  });

  const components = readFields(file, [
    ...lodGroupIds,
    ...owned.flatMap((o) => [o.renderer, o.filter]),
  ]);
  const candidates = owned.flatMap(({ node, renderer, filter }) => {
    const r = components.get(renderer)!;
    const mesh = flag(r.m_Enabled, 'm_Enabled') ? meshRef(file, components.get(filter)!) : null;
    if (mesh === null) return [];
    const materials = list(r.m_Materials, 'm_Materials').map((m) => localRef(m, 'm_Materials'));
    return [{ root: node.root, renderer, part: { mesh, matrix: node.matrix, materials } }];
  });
  const dropped = lodDropped(
    lodGroupIds.map((id) => components.get(id)!),
    new Set(candidates.map((c) => c.renderer))
  );
  onStep();

  const parts = new Map<bigint, RenderPart[]>(roots.map((root) => [root, []]));
  for (const { root, renderer, part } of candidates) {
    if (!dropped.has(renderer)) parts.get(root)!.push(part);
  }
  return parts;
};
