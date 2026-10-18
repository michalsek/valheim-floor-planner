/**
 * Palette thumbnails of real piece models (M14 assets), drawn by one small renderer of
 * their own: its own canvas and device (WebGL2 when the page is on `?webgl`), its own
 * model resources, so the plan's renderer never builds a pipeline or loses a texture
 * for them. A fixed 3/4 camera from the −z side (where roofs and furniture face) is
 * fitted to the model's bounds; the plan's sky / ground and sun light it, on a
 * transparent background that reads on both themes. `release` frees every GPU
 * resource and the device.
 */
import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Matrix4,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGPURenderer,
  type BufferGeometry,
  type InstancedBufferAttribute,
  type Mesh,
} from 'three/webgpu';

import { loadModel, loadTexture } from '../../install/assetClient';
import { instanceMatrices } from '../view3d/assets/gpuData';
import { createModelResources, type ModelResources } from '../view3d/assets/modelResources';
import { TINT_ATTRIBUTE } from '../view3d/assets/realMaterial';
import { bcSupport } from '../view3d/assets/textureSupport';

/** The thumbnail's size in pixels (about twice its box on the tile). */
export const THUMB_WIDTH = 128;
export const THUMB_HEIGHT = 106;

/** Towards the camera: the glyphs' view (`pieceGlyph.ts`), a little lower. */
const VIEW = new Vector3(1, 0.8, -1).normalize();
/** Towards the sun: above the camera's left shoulder. */
const SUN = new Vector3(1.2, 1.5, 0).normalize();
/** As `view3d/Lights.tsx`: sky and ground, and the sun. */
const SKY = '#ffffff';
const GROUND = '#8f949b';
const HEMISPHERE_INTENSITY = 1.2;
const SUN_INTENSITY = 2;
const EXPOSURE = 1.5;
/** Margin around the model, as a share of the frame. */
const MARGIN = 0.06;
/** Models kept loaded (their textures are shared, so most pieces add little). */
const KEPT_MODELS = 32;

interface Stage {
  renderer: WebGPURenderer;
  resources: ModelResources;
  scene: Scene;
  camera: OrthographicCamera;
  /** A 2D canvas the frame is copied into (same task) and encoded from. */
  copy: OffscreenCanvas;
  kept: string[];
}

let stage: Promise<Stage> | null = null;

const createStage = async (): Promise<Stage> => {
  const canvas = document.createElement('canvas');
  const renderer = new WebGPURenderer({
    canvas,
    alpha: true,
    antialias: true,
    forceWebGL: new URLSearchParams(window.location.search).has('webgl'),
  });
  await renderer.init();
  renderer.setPixelRatio(1);
  renderer.setSize(THUMB_WIDTH, THUMB_HEIGHT, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  // A touch brighter than the plan's view: dark wood reads at tile size.
  renderer.toneMappingExposure = EXPOSURE;
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  scene.add(new HemisphereLight(SKY, GROUND, HEMISPHERE_INTENSITY));
  const sun = new DirectionalLight(SKY, SUN_INTENSITY);
  sun.position.copy(SUN);
  scene.add(sun);
  const camera = new OrthographicCamera();
  const resources = createModelResources(bcSupport(renderer), { loadModel, loadTexture });
  const copy = new OffscreenCanvas(THUMB_WIDTH, THUMB_HEIGHT);
  return { renderer, resources, scene, camera, copy, kept: [] };
};

const getStage = (): Promise<Stage> => {
  if (!stage) {
    stage = createStage();
    stage.catch(() => (stage = null));
  }
  return stage;
};

/** Keeps `prefab`'s model and the last few others loaded; frees the rest. */
const keep = (s: Stage, prefab: string) => {
  s.kept = [prefab, ...s.kept.filter((p) => p !== prefab)].slice(0, KEPT_MODELS);
  s.resources.retain(new Set(s.kept));
};

/** One instance at the origin, untinted. */
const placeOnce = (mesh: Mesh) => {
  new Matrix4().toArray(instanceMatrices(mesh.geometry).array, 0);
  const tints = mesh.geometry.getAttribute(TINT_ATTRIBUTE) as InstancedBufferAttribute;
  tints.setXYZW(0, 0, 0, 0, 0);
  instanceMatrices(mesh.geometry).needsUpdate = true;
  tints.needsUpdate = true;
  (mesh as Mesh & { count: number }).count = 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
};

/** The camera looking along −VIEW at the box, its frame fitted around the box's corners. */
const fitCamera = (camera: OrthographicCamera, box: Box3) => {
  const centre = box.getCenter(new Vector3());
  const radius = Math.max(box.getSize(new Vector3()).length() / 2, 0.05);
  camera.position.copy(centre).addScaledVector(VIEW, radius * 4);
  camera.up.set(0, 1, 0);
  camera.lookAt(centre);
  camera.updateMatrixWorld();
  const view = camera.matrixWorldInverse;
  const local = new Box3();
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z])
        local.expandByPoint(new Vector3(x, y, z).applyMatrix4(view));
  const size = local.getSize(new Vector3());
  const mid = local.getCenter(new Vector3());
  const aspect = THUMB_WIDTH / THUMB_HEIGHT;
  const half = (Math.max(size.x / aspect, size.y) / 2) * (1 + 2 * MARGIN);
  camera.left = mid.x - half * aspect;
  camera.right = mid.x + half * aspect;
  camera.top = mid.y + half;
  camera.bottom = mid.y - half;
  camera.near = 0.01;
  camera.far = radius * 8;
  camera.updateProjectionMatrix();
};

/**
 * `prefab`'s thumbnail as a WebP (with alpha); null when its model draws nothing.
 * Rejects when the model can't be read (no game folder, a failed extraction).
 */
export const renderThumbnail = async (prefab: string): Promise<Blob | null> => {
  const s = await getStage();
  keep(s, prefab);
  const model = await s.resources.load(prefab);
  if (!model) return null;
  const meshes = model.groups.map((group) => s.resources.mesh(prefab, group, 1));
  const box = new Box3();
  for (const mesh of meshes) {
    placeOnce(mesh);
    const geometry = mesh.geometry as BufferGeometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (geometry.boundingBox) box.union(geometry.boundingBox);
  }
  if (box.isEmpty()) return null;
  fitCamera(s.camera, box);
  meshes.forEach((mesh) => s.scene.add(mesh));
  try {
    // Pipelines are built off the main thread where the backend can.
    await s.renderer.compileAsync(s.scene, s.camera);
    s.renderer.render(s.scene, s.camera);
    // Copied in the same task, before the canvas's frame is gone.
    const ctx = s.copy.getContext('2d');
    if (!ctx) return null;
    ctx.clearRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);
    ctx.drawImage(s.renderer.domElement, 0, 0);
  } finally {
    meshes.forEach((mesh) => s.scene.remove(mesh));
  }
  s.resources.prune();
  return s.copy.convertToBlob({ type: 'image/webp', quality: 0.9 });
};

/** Frees the thumbnail renderer: its models, meshes, textures, pipelines and device. */
export const releaseThumbnails = async (): Promise<void> => {
  const current = stage;
  stage = null;
  const s = await current?.catch(() => null);
  if (!s) return;
  s.resources.dispose();
  s.renderer.dispose();
};
