/**
 * Golden test against the real game: parses the local install and compares with the
 * game-data fixture (extracted with UnityPy, `testGameData.ts`). Runs only with
 * VALHEIM_INSTALL_TEST=1 (`pnpm test:install`); VALHEIM_DIR overrides the Steam install
 * path.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { readGameData } from '../../catalog/testGameData';

import { extractCatalogue, type RawPieces } from './extractCatalogue';
import { closeInstall, installSources } from './testInstall';

const sortedPoints = (points: readonly (readonly number[])[]) =>
  points.map((p) => [...p]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]! || a[2]! - b[2]!);

const expectClose = (actual: unknown, expected: unknown, path: string) => {
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    expect((actual as unknown[]).length, path).toBe(expected.length);
    expected.forEach((e, i) => expectClose((actual as unknown[])[i], e, `${path}[${i}]`));
  } else if (typeof expected === 'number') {
    expect(Math.abs((actual as number) - expected), path).toBeLessThanOrEqual(1e-3);
  } else {
    expect(actual, path).toEqual(expected);
  }
};

describe.skipIf(!process.env.VALHEIM_INSTALL_TEST)('extractCatalogue on the local install', () => {
  afterAll(closeInstall);

  it('matches the research fixture', { timeout: 120_000 }, () => {
    const { pieces, items } = extractCatalogue(installSources());
    const rawPieces = readGameData('valheim-pieces.json') as RawPieces;
    const fixture = rawPieces.pieces;

    expect(pieces.pieces.map((p) => p.prefab)).toEqual(fixture.map((p) => p.prefab));
    pieces.pieces.forEach((piece, i) => {
      const want = fixture[i]!;
      const { snapPoints, colliderBounds, colliderSize, ...rest } = piece;
      const { snapPoints: wantSnaps, colliderBounds: wantBounds, colliderSize: wantSize } = want;
      expect(rest, piece.prefab).toEqual({
        prefab: want.prefab,
        name: want.name,
        namePl: want.namePl,
        category: want.category,
        station: want.station,
        material: want.material,
        health: want.health,
        comfort: want.comfort,
        resources: want.resources,
      });
      expectClose(sortedPoints(snapPoints), sortedPoints(wantSnaps), `${piece.prefab}.snapPoints`);
      expectClose(colliderBounds, wantBounds, `${piece.prefab}.colliderBounds`);
      expectClose(colliderSize, wantSize, `${piece.prefab}.colliderSize`);
    });

    expect(items).toEqual(readGameData('valheim-items.json'));
    expect(pieces.meta.stationBuildRange).toMatchObject(rawPieces.meta.stationBuildRange);
    expect(pieces.meta.wardRadius_m).toBe(rawPieces.meta.wardRadius_m);
  });
});
