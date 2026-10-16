/// <reference types="node" />
/**
 * Golden test against the real game: parses the local install and compares with the
 * research fixture (extracted with UnityPy). Runs only with VALHEIM_INSTALL_TEST=1
 * (`pnpm test:install`); VALHEIM_DIR overrides the Steam install path.
 */
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import rawItems from '../../../research/valheim-items.json';
import rawPieces from '../../../research/valheim-pieces.json';

import type { ByteSource } from '../bytes/ByteSource';

import { HAMMER_TABLE_PATH } from './constants';
import { extractCatalogue, type ExtractResult, type RawPiece } from './extractCatalogue';
import { bundleFor } from './manifest';

const INSTALL =
  process.env.VALHEIM_DIR ??
  join(homedir(), 'Library/Application Support/Steam/steamapps/common/Valheim');
const DATA_DIRS = ['Valheim.app/Contents/Resources/Data', 'valheim_Data'];

const opened: number[] = [];
const fileSource = (path: string): ByteSource => {
  const fd = openSync(path, 'r');
  opened.push(fd);
  return {
    size: fstatSync(fd).size,
    read: (off, len) => {
      const bytes = new Uint8Array(len);
      readSync(fd, bytes, 0, len, off);
      return bytes;
    },
  };
};

const extract = (): ExtractResult => {
  const data = DATA_DIRS.map((d) => join(INSTALL, d)).find((d) => existsSync(d));
  if (!data) throw new Error(`No Valheim data folder under ${INSTALL}`);
  const softRef = join(data, 'StreamingAssets/SoftRef');
  const bundle = bundleFor(
    readFileSync(join(softRef, 'manifest_extended'), 'utf8'),
    HAMMER_TABLE_PATH
  );
  if (!bundle) throw new Error('The manifest has no piece table');
  return extractCatalogue({
    bundle: fileSource(join(softRef, 'Bundles', bundle)),
    resources: fileSource(join(data, 'resources.assets')),
  });
};

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
  afterAll(() => opened.forEach((fd) => closeSync(fd)));

  it('matches the research fixture', { timeout: 120_000 }, () => {
    const { pieces, items } = extract();
    const fixture = rawPieces.pieces as unknown as RawPiece[];

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

    expect(items).toEqual(rawItems);
    expect(pieces.meta.stationBuildRange).toMatchObject(rawPieces.meta.stationBuildRange);
    expect(pieces.meta.wardRadius_m).toBe(rawPieces.meta.wardRadius_m);
  });
});
