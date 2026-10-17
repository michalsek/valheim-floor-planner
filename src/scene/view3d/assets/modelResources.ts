/**
 * The GPU side of real models: each prefab's model (from `assetClient`) with its
 * groups' materials, textures shared by ID and materials by material ID. `retain` keeps
 * what the given prefabs use and disposes the rest.
 * Textures in formats the renderer can't sample are left out (the material falls
 * back to its `_Color`).
 */
import type { Material, Texture } from 'three/webgpu';

import type { Geometry } from '../../../gameData/valheim/bakeModel';
import type { ModelGroup, PrefabModel } from '../../../gameData/valheim/extractModels';
import { textureIdsOf } from '../../../gameData/valheim/extractModels';
import { loadModel, loadTexture } from '../../../install/assetClient';

import { createTexture } from './gpuData';
import { createRealMaterial } from './realMaterial';
import { canSample, type BcSupport } from './textureSupport';

export interface ReadyGroup {
  /** Unique within its model. */
  key: string;
  geometry: Geometry;
  /** Opaque (or cutout). */
  solid: Material;
  /** See-through, for door and gate panels. */
  panel: Material;
}

/** A model whose textures are loaded and whose materials are built. */
export interface ReadyModel {
  prefab: string;
  groups: ReadyGroup[];
}

export interface ModelResources {
  /**
   * The prefab's model, ready to draw; null when it draws nothing, undefined when the
   * prefab stopped being retained while it loaded.
   */
  load(prefab: string): Promise<ReadyModel | null | undefined>;
  /**
   * Keeps what `prefabs` use; disposes the other models' materials and textures. Loads
   * of other prefabs finishing later are dropped.
   */
  retain(prefabs: ReadonlySet<string>): void;
  /** `retain` of nothing: frees every material and texture (it can be used again). */
  dispose(): void;
}

/**
 * Materials that draw nothing in the game: the ships' water mask (a `Custom/Water`
 * mesh that keeps the sea out of the hull) would show as a white sheet.
 */
const HIDDEN_MATERIALS: ReadonlySet<string> = new Set(['watermask']);

interface Materials {
  solid: Material;
  panel: Material;
}

export const createModelResources = (support: BcSupport, panelOpacity: number): ModelResources => {
  const models = new Map<string, PrefabModel>();
  const textures = new Map<string, Promise<Texture | null>>();
  const created = new Map<string, Texture>();
  const materials = new Map<string, Materials>();
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

  const materialsFor = async ({ materialId, material: desc }: ModelGroup): Promise<Materials> => {
    const [albedo, normal, emission] = await Promise.all(
      [desc.albedo, desc.normal, desc.emission].map((id) => (id ? textureFor(id) : null))
    );
    let entry = materials.get(materialId);
    if (!entry) {
      const options = {
        desc,
        albedo: albedo ?? null,
        normal: normal ?? null,
        emission: emission ?? null,
      };
      entry = {
        solid: createRealMaterial({ ...options, opacity: 1 }),
        panel: createRealMaterial({ ...options, opacity: panelOpacity }),
      };
      materials.set(materialId, entry);
    }
    return entry;
  };

  const disposeMaterials = (entry: Materials) => {
    entry.solid.dispose();
    entry.panel.dispose();
  };

  /** Drops the models not wanted, then the materials and textures no model uses. */
  const sweep = () => {
    for (const prefab of models.keys()) if (!wanted.has(prefab)) models.delete(prefab);
    const kept = [...models.values()];
    const materialIds = new Set(kept.flatMap((m) => m.groups.map((g) => g.materialId)));
    const textureIds = new Set(kept.flatMap(textureIdsOf));
    for (const [id, entry] of materials) {
      if (materialIds.has(id)) continue;
      disposeMaterials(entry);
      materials.delete(id);
    }
    for (const [id, texture] of created) {
      if (textureIds.has(id)) continue;
      texture.dispose();
      created.delete(id);
      textures.delete(id);
    }
  };

  return {
    async load(prefab) {
      const model = await loadModel(prefab);
      if (!wanted.has(prefab)) return undefined;
      if (!model) return null;
      // Kept from now on, so a sweep while its textures load spares them.
      models.set(prefab, model);
      const shown = model.groups.filter((g) => !HIDDEN_MATERIALS.has(g.material.name));
      const groups = await Promise.all(
        shown.map(async (group, i) => ({
          key: `${i}:${group.materialId}`,
          geometry: group.geometry,
          ...(await materialsFor(group)),
        }))
      );
      if (models.get(prefab) !== model) {
        // No longer wanted meanwhile: drop what was built for it.
        sweep();
        return undefined;
      }
      return { prefab, groups };
    },

    retain(prefabs) {
      wanted = prefabs;
      sweep();
    },

    dispose() {
      wanted = new Set();
      sweep();
    },
  };
};
