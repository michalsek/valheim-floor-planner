/**
 * The GPU side of real models: each prefab's model (read through the injected loaders)
 * with its groups' materials, textures shared by ID and materials by material ID, and
 * the meshes that draw them. It outlives the 3D view (see `useModels.ts`), so going
 * back to 3D finds every program, buffer and texture still there. `retain` keeps what
 * the given prefabs use and disposes the rest; `dispose` frees everything.
 * Textures in formats the renderer can't sample are left out (the material falls
 * back to its `_Color`).
 */
import { Mesh, type BufferGeometry, type Material, type Texture } from 'three/webgpu';

import type { TextureData } from '../../../gameData/unity/texture2d';
import type { Geometry } from '../../../gameData/valheim/bakeModel';
import type { ModelGroup, PrefabModel } from '../../../gameData/valheim/extractModels';
import { textureIdsOf } from '../../../gameData/valheim/extractModels';

import { createInstancedGeometry, createTexture } from './gpuData';
import { createRealMaterial } from './realMaterial';
import { canSample, type BcSupport } from './textureSupport';

export interface ReadyGroup {
  /** Unique within its model. */
  key: string;
  geometry: Geometry;
  material: Material;
}

/** A model whose textures are loaded and whose materials are built. */
export interface ReadyModel {
  prefab: string;
  groups: ReadyGroup[];
}

export interface ModelLoaders {
  /** A prefab's model; null when it draws nothing. */
  loadModel(prefab: string): Promise<PrefabModel | null>;
  /** A texture by ID; null when it can't be read. */
  loadTexture(id: string): Promise<TextureData | null>;
}

export interface ModelResources {
  /**
   * The prefab's model, ready to draw; null when it draws nothing, undefined when the
   * prefab stopped being retained while it loaded.
   */
  load(prefab: string): Promise<ReadyModel | null | undefined>;
  /** A model already loaded (null: draws nothing), or undefined. */
  peek(prefab: string): ReadyModel | null | undefined;
  /**
   * The mesh drawing `group` of `prefab`, with room for at least `capacity` instances
   * (its geometry has the instance attributes, `gpuData.ts`). Kept while the prefab is
   * retained; a bigger one replaces it, and the old one goes at the next `prune`.
   */
  mesh(prefab: string, group: ReadyGroup, capacity: number): Mesh;
  /** Disposes meshes replaced by bigger ones (call once they are off the scene). */
  prune(): void;
  /**
   * Keeps what `prefabs` use; disposes the other models' meshes, materials and
   * textures. Loads of other prefabs finishing later are dropped.
   */
  retain(prefabs: ReadonlySet<string>): void;
  /** `retain` of nothing: frees everything (it can be used again). */
  dispose(): void;
}

/**
 * Materials that draw nothing in the game: the ships' water mask (a `Custom/Water`
 * mesh that keeps the sea out of the hull) would show as a white sheet.
 */
const HIDDEN_MATERIALS: ReadonlySet<string> = new Set(['watermask']);

interface PooledMesh {
  mesh: Mesh;
  capacity: number;
}

const createMesh = (group: ReadyGroup, capacity: number): Mesh => {
  const mesh = new Mesh(createInstancedGeometry(group.geometry, capacity), group.material);
  // Drawn `count` times (r186 reads `count` on any object); bounds follow the instances.
  (mesh as Mesh & { count: number }).count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

const disposeMesh = (mesh: Mesh) => (mesh.geometry as BufferGeometry).dispose();

export const createModelResources = (
  support: BcSupport,
  { loadModel, loadTexture }: ModelLoaders
): ModelResources => {
  const models = new Map<string, PrefabModel>();
  const ready = new Map<string, ReadyModel | null>();
  const textures = new Map<string, Promise<Texture | null>>();
  const created = new Map<string, Texture>();
  const materials = new Map<string, Material>();
  const meshes = new Map<string, PooledMesh>();
  const retired: Mesh[] = [];
  let wanted: ReadonlySet<string> = new Set();

  const textureFor = (id: string): Promise<Texture | null> => {
    let promise = textures.get(id);
    if (!promise) {
      promise = loadTexture(id).then((data) => {
        if (!data || !canSample(support, data.format, data.srgb)) return null;
        const texture = createTexture(data);
        created.set(id, texture);
        return texture;
      });
      // A failed read may be retried (after reconnecting the folder).
      promise.catch(() => textures.delete(id));
      textures.set(id, promise);
    }
    return promise;
  };

  const materialFor = async ({ materialId, material: desc }: ModelGroup): Promise<Material> => {
    const [albedo, normal, emission] = await Promise.all(
      [desc.albedo, desc.normal, desc.emission].map((id) => (id ? textureFor(id) : null))
    );
    let material = materials.get(materialId);
    if (!material) {
      material = createRealMaterial({
        desc,
        albedo: albedo ?? null,
        normal: normal ?? null,
        emission: emission ?? null,
      });
      materials.set(materialId, material);
    }
    return material;
  };

  const meshKey = (prefab: string, group: ReadyGroup) => `${prefab}\n${group.key}`;

  /** Drops the models not wanted, then the meshes, materials and textures no model uses. */
  const sweep = () => {
    for (const prefab of models.keys()) if (!wanted.has(prefab)) models.delete(prefab);
    for (const prefab of ready.keys()) if (!wanted.has(prefab)) ready.delete(prefab);
    for (const [key, { mesh }] of meshes) {
      if (models.has(key.slice(0, key.indexOf('\n')))) continue;
      disposeMesh(mesh);
      meshes.delete(key);
    }
    const kept = [...models.values()];
    const materialIds = new Set(kept.flatMap((m) => m.groups.map((g) => g.materialId)));
    const textureIds = new Set(kept.flatMap(textureIdsOf));
    for (const [id, material] of materials) {
      if (materialIds.has(id)) continue;
      material.dispose();
      materials.delete(id);
    }
    for (const [id, texture] of created) {
      if (textureIds.has(id)) continue;
      texture.dispose();
      created.delete(id);
      textures.delete(id);
    }
  };

  const prune = () => retired.splice(0).forEach(disposeMesh);

  return {
    async load(prefab) {
      if (ready.has(prefab)) return ready.get(prefab);
      const model = await loadModel(prefab);
      if (!wanted.has(prefab)) return undefined;
      if (!model) {
        ready.set(prefab, null);
        return null;
      }
      // Kept from now on, so a sweep while its textures load spares them.
      models.set(prefab, model);
      const shown = model.groups.filter((g) => !HIDDEN_MATERIALS.has(g.material.name));
      const groups = await Promise.all(
        shown.map(async (group, i) => ({
          key: `${i}:${group.materialId}`,
          geometry: group.geometry,
          material: await materialFor(group),
        }))
      );
      if (models.get(prefab) !== model) {
        // No longer wanted meanwhile: drop what was built for it.
        sweep();
        return undefined;
      }
      const result = ready.get(prefab) ?? { prefab, groups };
      ready.set(prefab, result);
      return result;
    },

    peek: (prefab) => ready.get(prefab),

    mesh(prefab, group, capacity) {
      const key = meshKey(prefab, group);
      const pooled = meshes.get(key);
      if (pooled && pooled.capacity >= capacity && pooled.mesh.material === group.material) {
        return pooled.mesh;
      }
      if (pooled) retired.push(pooled.mesh);
      const mesh = createMesh(group, capacity);
      meshes.set(key, { mesh, capacity });
      return mesh;
    },

    prune,

    retain(prefabs) {
      wanted = prefabs;
      sweep();
    },

    dispose() {
      wanted = new Set();
      sweep();
      prune();
    },
  };
};
