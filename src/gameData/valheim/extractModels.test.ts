/**
 * Golden test against the real game: extracts every piece's model and texture from the
 * local install and compares with `research/valheim-models.json` (counts, checksums,
 * bounds and formats from UnityPy, `research/extract/extract_models_golden.py`). Runs
 * only with VALHEIM_INSTALL_TEST=1 (`pnpm test:assets`).
 */
import { afterAll, describe, expect, it } from 'vitest';

import golden from '../../../research/valheim-models.json';
import rawPieces from '../../../research/valheim-pieces.json';

import { readMesh } from '../unity/mesh';
import { bundleResources } from '../unity/streamingInfo';
import { readFields } from '../unity/values';

import { builtinMesh } from './builtinMeshes';
import { openModelSource, textureIdsOf, type ModelSource, type PrefabModel } from './extractModels';
import { openPieceBundle, pieceTable } from './pieceBundle';
import { renderParts } from './renderParts';
import { closeInstall, installSources } from './testInstall';

interface GoldenGroup {
  vertices: number;
  indices: number;
  builtins: number[];
}
interface GoldenPrefab {
  parts: number;
  groups: Record<string, GoldenGroup>;
  bounds: [number[], number[]] | null;
}

const FORMATS: Record<number, string> = { 10: 'bc1', 12: 'bc3', 25: 'bc7' };
const BATCH = 25;

const close = (actual: number, expected: number, tolerance: number, what: string) =>
  expect(Math.abs(actual - expected), `${what}: ${actual} vs ${expected}`).toBeLessThanOrEqual(
    tolerance
  );

const sum = (values: ArrayLike<number> | null, stride = 1, take = stride): number | null => {
  if (!values) return null;
  let total = 0;
  for (let i = 0; i < values.length; i++) if (i % stride < take) total += values[i]!;
  return total;
};

const vertexCount = (model: PrefabModel) =>
  model.groups.reduce((n, g) => n + g.geometry.positions.length / 3, 0);

describe.skipIf(!process.env.VALHEIM_INSTALL_TEST)('extractModels on the local install', () => {
  afterAll(closeInstall);
  const timings: Record<string, number> = {};
  let source: ModelSource;
  const models = new Map<string, PrefabModel | null>();

  it('extracts one prefab cold, then another warm', { timeout: 60_000 }, () => {
    let start = performance.now();
    source = openModelSource(installSources().bundle);
    const woodwall = source.model('woodwall');
    timings.coldWoodwall = performance.now() - start;
    start = performance.now();
    const roof = source.model('darkwood_roof');
    timings.warmDarkwoodRoof = performance.now() - start;

    // woodwall: one part, the combined mesh `woodwall_new`.
    expect(woodwall?.parts).toBe(1);
    expect(woodwall?.groups).toHaveLength(1);
    expect(vertexCount(woodwall!)).toBe(396);
    expect(woodwall!.groups[0]!.geometry.indices.length).toBe(792);
    expect(woodwall!.groups[0]!.material.uvST.map((v) => Math.round(v * 1000) / 1000)).toEqual([
      -0.56, 0.12, 0, 0.014,
    ]);
    expect(roof && vertexCount(roof)).toBe(516);
    expect(roof?.groups[0]!.geometry.indices.length).toBe(1464);

    const [albedo, normal] = [
      source.texture(woodwall!.groups[0]!.material.albedo!),
      source.texture(woodwall!.groups[0]!.material.normal!),
    ];
    expect(albedo).toMatchObject({ name: 'Planks5c_low', format: 'bc1', width: 128, height: 128 });
    expect(albedo!.srgb).toBe(true);
    expect(albedo!.filter).toBe(0);
    expect(albedo!.mips).toHaveLength(8);
    expect(sum(albedo!.mips.map((m) => m.length))).toBe(10_936);
    expect(normal).toMatchObject({ name: 'Planks5c_low_n', format: 'bc3', srgb: false });
    expect(sum(normal!.mips.map((m) => m.length))).toBe(21_872);
  });

  it('reads darkwood_roof from .resS with half normals', () => {
    const { bundle, file } = openPieceBundle(installSources().bundle);
    const root = pieceTable(file).find(
      (id) => readFields(file, [id]).get(id)!.m_Name === 'darkwood_roof'
    )!;
    const [part] = renderParts(file, [root]).get(root)!;
    const id = part!.mesh as bigint;
    const mesh = readMesh(readFields(file, [id]).get(id)!, bundleResources(bundle));
    expect(mesh).toMatchObject({ vertexCount: 516, streamed: true, normalFormat: 1 });
    expect(mesh.indices.length).toBe(1464);
  });

  it('extracts every piece (batched)', { timeout: 120_000 }, () => {
    const start = performance.now();
    const names = source.prefabs();
    for (let i = 0; i < names.length; i += BATCH) {
      for (const [name, model] of source.models(names.slice(i, i + BATCH))) models.set(name, model);
    }
    timings.allModels = performance.now() - start;
    const ids = [...new Set([...models.values()].flatMap((m) => (m ? textureIdsOf(m) : [])))];
    const texStart = performance.now();
    const textures = source.textures(ids);
    timings.allTextures = performance.now() - texStart;
    console.log('timings (ms)', timings, `${models.size} models, ${textures.size} textures`);

    expect(models.get('wood_roof')?.groups).toHaveLength(3);
    expect(models.get('fire_pit_iron')?.parts).toBe(1);
    expect(models.get('blastfurnace')?.parts).toBe(1);
    expect([...textures.values()].every((t) => t !== null)).toBe(true);
  });

  it('matches the UnityPy golden: meshes', { timeout: 60_000 }, () => {
    const { bundle, file } = openPieceBundle(installSources().bundle);
    const ids = Object.keys(golden.meshes).map(BigInt);
    const res = bundleResources(bundle);
    for (const [id, fields] of readFields(file, ids)) {
      const want = golden.meshes[String(id) as keyof typeof golden.meshes];
      const mesh = readMesh(fields, res);
      const what = `${want.name} (${id})`;
      expect(mesh.name, what).toBe(want.name);
      expect([mesh.vertexCount, mesh.indices.length], what).toEqual([want.vertices, want.indices]);
      expect([mesh.streamed, mesh.normalFormat], what).toEqual([want.streamed, want.normalFormat]);
      close(sum(mesh.positions)!, want.posSum, 0.02, `${what} positions`);
      if (want.normalSum !== null)
        close(sum(mesh.normals)!, want.normalSum, 0.02, `${what} normals`);
      if (want.uvSum !== null) close(sum(mesh.uv0)!, want.uvSum, 0.02, `${what} uvs`);
    }
  });

  it('matches the UnityPy golden: prefabs and textures', () => {
    const prefabs = golden.prefabs as unknown as Record<string, GoldenPrefab>;
    expect([...models.keys()].sort()).toEqual(Object.keys(prefabs).sort());
    for (const [name, want] of Object.entries(prefabs)) {
      const model = models.get(name) ?? null;
      if (Object.keys(want.groups).length === 0) {
        expect(model, name).toBeNull();
        continue;
      }
      expect(model?.parts, name).toBe(want.parts);
      const groups = Object.fromEntries(
        model!.groups.map((g) => [
          g.materialId,
          [g.geometry.positions.length / 3, g.geometry.indices.length],
        ])
      );
      const expected = Object.fromEntries(
        Object.entries(want.groups).map(([id, g]) => {
          const builtins = g.builtins.map((b) => builtinMesh(b)!);
          return [
            id,
            [
              g.vertices + builtins.reduce((n, b) => n + b.vertexCount, 0),
              g.indices + builtins.reduce((n, b) => n + b.indices.length, 0),
            ],
          ];
        })
      );
      expect(groups, name).toEqual(expected);
      if (want.bounds) {
        [...model!.bounds.min, ...model!.bounds.max].forEach((v, i) =>
          close(v, want.bounds!.flat()[i]!, 1.5e-3, `${name} bounds[${i}]`)
        );
      }
    }

    for (const [id, want] of Object.entries(golden.textures)) {
      const texture = source.texture(id);
      const raw = want.format === 3 ? 4 / 3 : 1; // RGB24 is expanded to RGBA8
      expect(texture, want.name).toMatchObject({
        name: want.name,
        format: FORMATS[want.format] ?? 'rgba8',
        width: want.width,
        height: want.height,
        srgb: want.colorSpace === 1,
        filter: want.filter,
      });
      expect(texture!.mips, want.name).toHaveLength(want.mips);
      expect(sum(texture!.mips.map((m) => m.length)), want.name).toBe(want.bytes * raw);
    }
  });

  it('keeps walls and floors within their colliders (± 0.3 m)', () => {
    const colliders = new Map(rawPieces.pieces.map((p) => [p.prefab, p.colliderBounds]));
    const checked = [...models].filter(([name, model]) => model && /wall|floor/.test(name));
    const outside = checked.flatMap(([name, model]) => {
      const [min, max] = colliders.get(name)! as [number[], number[]];
      const over = [0, 1, 2].flatMap((a) => [
        min[a]! - model!.bounds.min[a]!,
        model!.bounds.max[a]! - max[a]!,
      ]);
      return Math.max(...over) > 0.3 ? [name] : [];
    });
    expect(checked.length).toBeGreaterThan(80);
    // Logs and sharpened stakes poke out past their colliders.
    expect(outside.sort()).toEqual([
      'piece_dvergr_stake_wall',
      'piece_stakewall_blackwood',
      'wood_wall_log_4x0.5',
    ]);
  });
});
