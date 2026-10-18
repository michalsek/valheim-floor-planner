/**
 * Sites a plan's terrain reveals: the world's sites (`groupPieces`, any size) with a piece
 * on the plan's terrain patch that the plan doesn't hold yet. A revealed site comes in
 * whole, even where it reaches past the patch, in the plan's own frame (origin, yaw and
 * datum from the first import) and on levels by the wall rule against the plan's
 * levels. Which sites the plan holds comes from its frame's `worldPieces`: a site with
 * any of its pieces there is in the plan, so pieces deleted from the plan never come
 * back, and a site isn't brought in twice after an undo, a redo or a reopen. Pure.
 */
import { MAX_RAW_PIECES } from '../rawPieces';
import type { PatchRect } from '../terrain/sitePatch';
import { planToWorld } from '../terrain/siteTerrain';
import type { Plan, RawPiece } from '../types';

import { groupPieces } from './clusters';
import { framePieces, rawPiecesInFrame, type ImportLib } from './framePieces';
import { cloudSize, type PieceCloud } from './pieceCloud';
import { sortedKeys, worldPieceKey } from './worldKeys';

/** A world's sites, worked out once per read world. */
export interface WorldSites {
  /** Pieces by site, largest first (`groupPieces`). */
  groups: number[][];
  /** Each piece's site: an index into `groups`. */
  siteOf: Int32Array;
  /** Each piece's key (`worldPieceKey`). */
  keys: Float64Array;
}

export const worldSites = (cloud: PieceCloud): WorldSites => {
  const groups = groupPieces(cloud);
  const siteOf = new Int32Array(cloudSize(cloud));
  groups.forEach((group, g) => group.forEach((i) => (siteOf[i] = g)));
  const keys = Float64Array.from({ length: cloudSize(cloud) }, (_, i) => worldPieceKey(cloud, i));
  return { groups, siteOf, keys };
};

/** How near (metres) a plan piece must sit to a world piece to be it, in an older plan. */
const MATCH = 0.03;

/**
 * The world pieces an older plan holds (imported before `worldPieces`): its pieces
 * mapped back through the frame onto world pieces of the same prefab.
 */
const matchedPieces = (cloud: PieceCloud, plan: Plan): number[] => {
  const frame = plan.importFrame!;
  const cell = (x: number, z: number) => `${Math.round(x / MATCH)},${Math.round(z / MATCH)}`;
  const byCell = new Map<string, number[]>();
  for (let i = 0; i < cloudSize(cloud); i++) {
    const key = cell(cloud.position[i * 3]!, cloud.position[i * 3 + 2]!);
    byCell.set(key, [...(byCell.get(key) ?? []), i]);
  }
  const found: number[] = [];
  for (const piece of Object.values(plan.rawPieces)) {
    const at = planToWorld(frame, piece.position);
    const [cx, cz] = cell(at.x, at.z).split(',').map(Number) as [number, number];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (const i of byCell.get(`${cx + dx},${cz + dz}`) ?? []) {
          const prefab = cloud.prefabs[cloud.prefabIndex[i]!];
          const near =
            Math.hypot(cloud.position[i * 3]! - at.x, cloud.position[i * 3 + 2]! - at.z) <= MATCH;
          if (prefab === piece.prefab && near) found.push(i);
        }
      }
    }
  }
  return found;
};

/** The sites `plan` holds, and the keys it holds them by. */
export const plannedSites = (
  cloud: PieceCloud,
  sites: WorldSites,
  plan: Plan
): { sites: Set<number>; keys: number[] } => {
  const frame = plan.importFrame;
  if (!frame) return { sites: new Set(), keys: [] };
  if (frame.worldPieces) {
    const held = new Set(frame.worldPieces);
    const planned = new Set<number>();
    sites.keys.forEach((key, i) => {
      if (held.has(key)) planned.add(sites.siteOf[i]!);
    });
    return { sites: planned, keys: frame.worldPieces };
  }
  const planned = new Set(matchedPieces(cloud, plan).map((i) => sites.siteOf[i]!));
  const keys = [...planned].flatMap((g) => sites.groups[g]!.map((i) => sites.keys[i]!));
  return { sites: planned, keys: sortedKeys(keys) };
};

/** The sites with a piece on `rect` (world vertices) that aren't in `planned`, largest first. */
export const sitesOnPatch = (
  cloud: PieceCloud,
  sites: WorldSites,
  rect: PatchRect,
  planned: ReadonlySet<number>
): number[] => {
  const found = new Set<number>();
  for (let i = 0; i < cloudSize(cloud); i++) {
    const x = cloud.position[i * 3]! - rect.x0;
    const z = cloud.position[i * 3 + 2]! - rect.z0;
    const site = sites.siteOf[i]!;
    if (x >= 0 && z >= 0 && x <= rect.cols - 1 && z <= rect.rows - 1 && !planned.has(site)) {
      found.add(site);
    }
  }
  return [...found].sort((a, b) => a - b);
};

/** What revealing adds to a plan. */
export interface Reveal {
  pieces: RawPiece[];
  /** The frame's new `worldPieces` (the plan's and the revealed sites'). */
  worldPieces: number[];
  /** The revealed sites' piece counts, largest first. */
  sites: number[];
  /** Sites found but left out, and why. */
  refused: { pieces: number; reason: string }[];
}

/**
 * The sites `rect` reveals for `plan` (its frame's world), as raw pieces in its frame.
 * Sites beyond the plan's piece limit, or reaching too far off its levels, are refused
 * with their reason, never dropped unseen.
 */
export const revealSites = (
  cloud: PieceCloud,
  sites: WorldSites,
  plan: Plan,
  rect: PatchRect,
  lib: ImportLib
): Reveal => {
  const frame = plan.importFrame;
  const out: Reveal = { pieces: [], worldPieces: frame?.worldPieces ?? [], sites: [], refused: [] };
  if (!frame) return out;
  const planned = plannedSites(cloud, sites, plan);
  const levels = [...new Set(Object.values(plan.rawPieces).map((p) => p.elevation))];
  const taken = new Set(Object.keys(plan.rawPieces));
  const keys = [...planned.keys];
  let count = taken.size;
  for (const site of sitesOnPatch(cloud, sites, rect, planned.sites)) {
    const members = sites.groups[site]!;
    if (count + members.length > MAX_RAW_PIECES) {
      const reason = `a plan holds at most ${MAX_RAW_PIECES.toLocaleString('en-GB')} pieces`;
      out.refused.push({ pieces: members.length, reason });
      continue;
    }
    const idOf = (k: number) => {
      const base = `w${sites.keys[members[k]!]!.toString(36)}`;
      let id = base;
      for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
      taken.add(id);
      return id;
    };
    try {
      const framed = framePieces(cloud, members, frame, lib);
      const { pieces } = rawPiecesInFrame(framed, frame.origin.y, lib, idOf, levels);
      out.pieces.push(...pieces);
    } catch (error) {
      out.refused.push({ pieces: members.length, reason: (error as Error).message });
      continue;
    }
    out.sites.push(members.length);
    keys.push(...members.map((i) => sites.keys[i]!));
    count += members.length;
  }
  out.worldPieces = out.sites.length > 0 ? sortedKeys(keys) : planned.keys;
  return out;
};
