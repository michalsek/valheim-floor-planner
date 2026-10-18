import { describe, expect, it } from 'vitest';

import { testLibrary } from '../../catalog/testLibrary';
import { applyCommands } from '../commands';
import type { Plan } from '../types';

import { describeCluster } from './clusters';
import { importCluster } from './importCluster';
import type { PieceCloud } from './pieceCloud';
import { reframePlan, reframeProblem } from './reframe';

/** A 4 × 2 m deck turned 22.5° (saved truncated), with a wall and a chest at its own angle. */
const DEG = Math.PI / 180;
const at = (u: number, v: number): [number, number] => [
  250.4 + u * Math.cos(22.5 * DEG) + v * Math.sin(22.5 * DEG),
  -80.7 - u * Math.sin(22.5 * DEG) + v * Math.cos(22.5 * DEG),
];
const specs: [string, number, number, number, number][] = [
  ['wood_floor', ...at(1, 1), 31.25, 22],
  ['wood_floor', ...at(3, 1), 31.25, 22],
  ['woodwall', ...at(1, 0), 32.25, 22],
  ['piece_chest_wood', ...at(2, 1.5), 31.25, 67.5],
].map(([p, x, z, y, r]) => [p, x, y, z, r] as [string, number, number, number, number]);
const prefabs = specs.map((s) => s[0]);
const cloud: PieceCloud = {
  prefabs,
  prefabIndex: prefabs.map((_, i) => i),
  position: specs.flatMap(([, x, y, z]) => [x, y, z]),
  rotation: specs.flatMap((s) => [0, s[4], 0]),
};
const cluster = describeCluster(cloud, [0, 1, 2, 3], () => null);
const imported = (grid: 'world' | 'build') =>
  importCluster(cloud, cluster, testLibrary, 'Fixture', grid).plan;

const reframed = (plan: Plan, grid: 'world' | 'build'): Plan =>
  applyCommands(plan, [{ type: 'site.reframe', ...reframePlan(plan, testLibrary, grid) }]);

/** The plan's frame and pieces, rounded past float noise. */
const layout = (plan: Plan) => ({
  origin: plan.importFrame!.origin,
  yaw: plan.importFrame!.yaw,
  pieces: Object.values(plan.rawPieces).map((p) => ({
    ...p,
    position: {
      x: +p.position.x.toFixed(5),
      y: +p.position.y.toFixed(5),
      z: +p.position.z.toFixed(5),
    },
  })),
});

describe('re-framing an import', () => {
  it('turns a world-axes import onto the build’s grid and back, as an import would', () => {
    const world = imported('world');
    const build = reframed(world, 'build');
    expect(layout(build)).toEqual(layout(imported('build')));
    expect(layout(reframed(build, 'world'))).toEqual(layout(world));
    // The datum and levels stay, so the terrain (heights above the datum) does too.
    expect(build.importFrame!.origin.y).toBe(world.importFrame!.origin.y);
  });

  it('is refused while the plan holds anything drawn', () => {
    const plan = applyCommands(imported('world'), [
      {
        type: 'dimension.insert',
        dimension: { id: 'd1', a: { x: 0, z: 0 }, b: { x: 2, z: 0 }, offset: 1, elevation: 0 },
      },
    ]);
    expect(reframeProblem(plan)).toMatch(/1 drawn item/);
    expect(() => reframePlan(plan, testLibrary, 'build')).toThrow(/drawn item/);
    const turn = reframePlan(imported('world'), testLibrary, 'build');
    expect(() => applyCommands(plan, [{ type: 'site.reframe', ...turn }])).toThrow(/drawn item/);
  });
});
