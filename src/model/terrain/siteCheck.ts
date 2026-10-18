/**
 * What a stored `SiteTerrain` must satisfy (shared by `parsePlan` and the
 * `site.setTerrain` command, so the autosave always reads back).
 */
import type { SiteTerrain } from '../types';

import { MAX_SITE_SIDE } from './sitePatch';

/** Vertices a side may have: 2 up to a fully extended patch's. */
const MAX_VERTICES_SIDE = MAX_SITE_SIDE + 1;

const finite = (n: number) => Number.isFinite(n);
const count = (n: number) => Number.isInteger(n) && n >= 0;

/** The game's zones (metres): zone corner `k` is at world `k · 64 − 32`. */
const ZONE_SIZE = 64;

/** Whether `corners` zone corners from zone `first` span the patch's `vertices` from `start`. */
const covers = (first: number, corners: number, start: number, vertices: number): boolean => {
  const low = first * ZONE_SIZE - ZONE_SIZE / 2;
  const high = (first + corners - 1) * ZONE_SIZE - ZONE_SIZE / 2;
  return low <= start && high >= start + vertices - 1;
};

/**
 * A self-check error above this (metres: the save's location heights against the
 * generator's) says the ground may not match the world.
 */
export const MISMATCH = 0.05;

const sideProblem = (n: number, what: string): string | null =>
  Number.isInteger(n) && n >= 2 && n <= MAX_VERTICES_SIDE
    ? null
    : `${what} from 2 to ${MAX_VERTICES_SIDE}`;

/** Why `t` can't be stored, or null. */
export const siteTerrainProblem = (t: SiteTerrain): string | null => {
  if (!Number.isInteger(t.x0) || !Number.isInteger(t.z0)) return 'whole-metre x0 and z0';
  const sides = sideProblem(t.cols, 'cols') ?? sideProblem(t.rows, 'rows');
  if (sides) return sides;
  if (!(t.heights instanceof Int16Array) || t.heights.length !== t.cols * t.rows) {
    return `heights of ${t.cols} × ${t.rows} int16 values`;
  }
  const b = t.biomes;
  if (![b.zx0, b.zz0, b.cols, b.rows].every(Number.isInteger) || b.cols < 2 || b.rows < 2) {
    return 'a biome grid of whole zones, at least 2 × 2 corners';
  }
  if (!covers(b.zx0, b.cols, t.x0, t.cols) || !covers(b.zz0, b.rows, t.z0, t.rows)) {
    return 'a biome grid over the whole patch';
  }
  if (b.codes.length !== b.cols * b.rows || !b.codes.every(Number.isInteger)) {
    return `${b.cols} × ${b.rows} biome codes`;
  }
  if (!Number.isInteger(t.worldGenVersion) || !Number.isInteger(t.revision)) {
    return 'whole-number generator versions';
  }
  const { locations, legacyEdits, unreadEdits, check } = t.notices;
  if (!locations.every((p) => finite(p.x) && finite(p.z))) return 'location notices at points';
  if (!count(legacyEdits)) return 'a count of legacy edits';
  if (!count(unreadEdits)) return 'a count of unread terrain edits';
  if (!Number.isInteger(check.n) || check.n < 0 || !finite(check.maxError)) {
    return 'a self-check count and error';
  }
  return null;
};
