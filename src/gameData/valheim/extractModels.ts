/**
 * Real piece models from the piece-table bundle: each prefab's render parts baked and
 * merged by material (`bakeModel.ts`), with the materials' render state, plus the
 * textures they use. Coordinates stay raw Unity ones (`space: 'unity'`), like the
 * catalogue's, so models line up with the planner's boxes. Reads are batched: one
 * sweep of the bundle per hierarchy level, then one each for the components, meshes
 * and materials of every prefab asked for.
 */
import type { ByteSource } from '../bytes/ByteSource';
import { GameDataError } from '../GameDataError';
import type { Bounds, MeshData } from '../unity/mesh';
import { readMesh } from '../unity/mesh';
import { bundleResources } from '../unity/streamingInfo';
import { readTexture, type TextureData } from '../unity/texture2d';
import { readFields, str } from '../unity/values';

import { bakeModel, type BakePart, type Geometry } from './bakeModel';
import { builtinMesh } from './builtinMeshes';
import { materialDesc, type MaterialDesc } from './material';
import { openPieceBundle, pieceTable } from './pieceBundle';
import { renderParts, type MeshRef } from './renderParts';

const CLASS_TEXTURE_2D = 28;

export interface ModelGroup {
  /** The material's path ID (decimal). */
  materialId: string;
  material: MaterialDesc;
  geometry: Geometry;
}

export interface PrefabModel {
  name: string;
  /** Raw Unity coordinates (left-handed), as in the catalogue. */
  space: 'unity';
  /** Render parts merged into the groups. */
  parts: number;
  groups: ModelGroup[];
  bounds: Bounds;
}

export interface ModelSource {
  /** The piece-table prefabs' names, in table order. */
  prefabs(): string[];
  /** The prefab's model; null when it isn't on the piece table or draws nothing. */
  model(name: string): PrefabModel | null;
  /** Several models in one batch (one sweep of the bundle per step). */
  models(names: readonly string[]): Map<string, PrefabModel | null>;
  /** A texture by path ID; null when there is none or its format isn't read. */
  texture(id: string): TextureData | null;
  textures(ids: readonly string[]): Map<string, TextureData | null>;
}

/** The texture IDs a model's materials use (albedo, normal, emission). */
export const textureIdsOf = (model: PrefabModel): string[] => [
  ...new Set(
    model.groups.flatMap(({ material: m }) =>
      [m.albedo, m.normal, m.emission].filter((id) => id !== null)
    )
  ),
];

const parseId = (id: string): bigint | null => {
  try {
    return BigInt(id);
  } catch {
    return null;
  }
};

const builtins = new Map<number, MeshData | null>();
const builtin = (pathId: number): MeshData | null => {
  if (!builtins.has(pathId)) builtins.set(pathId, builtinMesh(pathId));
  return builtins.get(pathId)!;
};

export const openModelSource = (bundleSource: ByteSource): ModelSource => {
  const { bundle, file } = openPieceBundle(bundleSource);
  const res = bundleResources(bundle);
  const roots = pieceTable(file);
  const rootObjects = readFields(file, roots);
  const byName = new Map(roots.map((id) => [str(rootObjects.get(id)!.m_Name, 'm_Name'), id]));
  let textureIds: Set<bigint> | null = null;

  /** Reads every mesh once; an unsupported one (compressed) is left out. */
  const readMeshes = (refs: Iterable<MeshRef>): Map<MeshRef, MeshData | null> => {
    const local = [...new Set([...refs].filter((r) => typeof r === 'bigint'))];
    const meshes = new Map<MeshRef, MeshData | null>();
    for (const [id, f] of readFields(file, local)) {
      try {
        meshes.set(id, readMesh(f, res));
      } catch (error) {
        if (!(error instanceof GameDataError && error.code === 'unsupported')) throw error;
        meshes.set(id, null);
      }
    }
    return meshes;
  };

  const models = (names: readonly string[]): Map<string, PrefabModel | null> => {
    const wanted = names.flatMap((name) => {
      const id = byName.get(name);
      return id === undefined ? [] : [{ name, id }];
    });
    const parts = renderParts(
      file,
      wanted.map((w) => w.id)
    );
    const all = [...parts.values()].flat();
    const meshes = readMeshes(all.map((p) => p.mesh));
    const materialIds = new Set(all.flatMap((p) => p.materials).filter((id) => id !== null));
    const materials = new Map(
      [...readFields(file, materialIds)].map(([id, f]) => [String(id), materialDesc(f)])
    );

    const result = new Map<string, PrefabModel | null>(names.map((name) => [name, null]));
    for (const { name, id } of wanted) {
      const bakeParts = parts.get(id)!.flatMap((part): BakePart[] => {
        const mesh =
          typeof part.mesh === 'bigint' ? meshes.get(part.mesh) : builtin(part.mesh.builtin);
        if (!mesh) return [];
        const ids = part.materials.map((m) => (m === null ? null : String(m)));
        return [{ mesh, matrix: part.matrix, materials: ids }];
      });
      const baked = bakeModel(bakeParts);
      if (!baked) continue;
      result.set(name, {
        name,
        space: 'unity',
        parts: bakeParts.length,
        bounds: baked.bounds,
        groups: baked.groups.map(({ material, geometry }) => ({
          materialId: material,
          material: materials.get(material)!,
          geometry,
        })),
      });
    }
    return result;
  };

  const textures = (ids: readonly string[]): Map<string, TextureData | null> => {
    textureIds ??= new Set(file.idsOfClass(CLASS_TEXTURE_2D));
    const known = textureIds;
    const found = new Map(
      ids.flatMap((id) => {
        const pathId = parseId(id);
        return pathId !== null && known.has(pathId) ? [[pathId, id] as const] : [];
      })
    );
    const read = readFields(file, found.keys());
    const result = new Map<string, TextureData | null>(ids.map((id) => [id, null]));
    for (const [pathId, f] of read) result.set(found.get(pathId)!, readTexture(f, res));
    return result;
  };

  return {
    prefabs: () => [...byName.keys()],
    model: (name) => models([name]).get(name) ?? null,
    models,
    texture: (id) => textures([id]).get(id) ?? null,
    textures,
  };
};
