/**
 * What a stored `SiteTerrain` must satisfy (shared by `parsePlan` and the
 * `site.setTerrain` command, so the autosave always reads back).
 */
import type { SiteTerrain } from '../types';

import { MAX_SIDE } from './sitePatch';

/** Vertices a side may have: 2 up to a capped patch's. */
const MAX_VERTICES_SIDE = MAX_SIDE + 1;

const finite = (n: number) => Number.isFinite(n);

/** Bytes the base64 string decodes to (without decoding it). */
const base64Bytes = (text: string): number | null => {
  if (text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  const pad = text.endsWith('==') ? 2 : text.endsWith('=') ? 1 : 0;
  return (text.length / 4) * 3 - pad;
};

const sideProblem = (n: number, what: string): string | null =>
  Number.isInteger(n) && n >= 2 && n <= MAX_VERTICES_SIDE
    ? null
    : `${what} from 2 to ${MAX_VERTICES_SIDE}`;

/** Why `t` can't be stored, or null. */
export const siteTerrainProblem = (t: SiteTerrain): string | null => {
  if (!Number.isInteger(t.x0) || !Number.isInteger(t.z0)) return 'whole-metre x0 and z0';
  const sides = sideProblem(t.cols, 'cols') ?? sideProblem(t.rows, 'rows');
  if (sides) return sides;
  if (base64Bytes(t.heights) !== t.cols * t.rows * 2) {
    return `heights of ${t.cols} × ${t.rows} int16 values in base64`;
  }
  const b = t.biomes;
  if (![b.zx0, b.zz0, b.cols, b.rows].every(Number.isInteger) || b.cols < 1 || b.rows < 1) {
    return 'a biome grid of whole zones';
  }
  if (b.codes.length !== b.cols * b.rows || !b.codes.every(Number.isInteger)) {
    return `${b.cols} × ${b.rows} biome codes`;
  }
  if (!Number.isInteger(t.worldGenVersion) || !Number.isInteger(t.revision)) {
    return 'whole-number generator versions';
  }
  const { locations, legacyEdits, check } = t.notices;
  if (!locations.every((p) => finite(p.x) && finite(p.z))) return 'location notices at points';
  if (!Number.isInteger(legacyEdits) || legacyEdits < 0) return 'a count of legacy edits';
  if (!Number.isInteger(check.n) || check.n < 0 || !finite(check.maxError)) {
    return 'a self-check count and error';
  }
  return null;
};
