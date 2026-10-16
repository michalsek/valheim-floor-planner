/** Wall pieces, opening pieces and their warnings, per wall run (cached). */
import type { Library } from '../catalog/library';
import type { WallFamily } from '../catalog/wallFamilies';

import { isCut, resolveOpenings, wallCuts, type ResolvedOpening } from './openings';
import { splitWall, type SplitIssue } from './splitWall';
import type { Opening, PlacedPiece, Plan, PlanWarning, WallId, WallRun } from './types';

export interface WallsResult {
  pieces: PlacedPiece[];
  warnings: PlanWarning[];
  openings: ResolvedOpening[];
}

interface WallEntry {
  family: WallFamily | undefined;
  /** The wall's openings the result was made with (compared by reference). */
  openings: readonly Opening[];
  result: WallsResult;
}

// Plan objects are immutable, so a run with the same openings keeps its split.
const wallCache = new WeakMap<WallRun, WallEntry>();

const sameRefs = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const wallWarning = (wallId: WallId, segment: number | null, message: string): PlanWarning => ({
  source: { kind: 'wall', id: wallId },
  segment,
  message,
  level: 'warning',
});

const issueMessage = (issue: SplitIssue): string =>
  issue.kind === 'unfilled'
    ? `Segment ${issue.segment + 1}: ${issue.area.toFixed(2)} m² can't be filled with whole pieces`
    : `Segment ${issue.segment + 1} is no longer than the wall is thick, so it has no pieces`;

const openingProblem = (r: ResolvedOpening): string | null => {
  const name = r.def?.label ?? 'Opening';
  const where = r.segment === null ? '' : ` on segment ${r.segment + 1}`;
  switch (r.problem) {
    case 'offWall':
      return `${name} is no longer on its wall`;
    case 'doesNotFit':
      return `${name} doesn't fit${where}`;
    case 'overlaps':
      return `${name} overlaps another opening${where}`;
    case 'unknownPrefab':
      return `Unknown opening "${r.prefab}"`;
    case null:
      return null;
  }
};

const openingWarnings = (run: WallRun, resolved: readonly ResolvedOpening[]): PlanWarning[] =>
  resolved.flatMap((r) => {
    const source = { kind: 'opening', id: r.id } as const;
    const problem = openingProblem(r);
    const warnings: PlanWarning[] = [];
    if (problem) warnings.push({ source, segment: r.segment, message: problem, level: 'warning' });
    // Only a cut opening cuts the full height.
    if (r.tooTall && isCut(r)) {
      const message = `${r.def.label} (${r.def.height} m) is taller than its ${run.height} m wall, so it cuts the full height`;
      warnings.push({ source, segment: r.segment, message, level: 'info' });
    }
    return warnings;
  });

/** The piece a cut opening adds: the door or gate itself, in its gap. */
const openingPiece = (r: ResolvedOpening, family: WallFamily): PlacedPiece[] => {
  if (!isCut(r)) return [];
  return [
    {
      key: `${r.id}:${r.segment}:0:0`,
      kind: 'opening',
      prefab: r.def.prefab,
      material: r.def.material,
      sourceId: r.id,
      segment: r.segment,
      course: 0,
      base: 0,
      height: r.def.height,
      center: r.stripCenter,
      rotation: Math.atan2(r.dir.z, r.dir.x),
      footprint: { length: r.def.width, thickness: family.thickness },
    },
  ];
};

const deriveWall = (run: WallRun, openings: readonly Opening[], lib: Library): WallsResult => {
  const family = lib.wallFamilies.get(run.familyId);
  const cached = wallCache.get(run);
  if (cached && cached.family === family && sameRefs(cached.openings, openings)) {
    return cached.result;
  }

  const resolved = resolveOpenings(run, family, openings, lib.openingDefs);
  const warnings = openingWarnings(run, resolved);
  let result: WallsResult;
  if (family) {
    const split = splitWall(run, family, wallCuts(resolved));
    result = {
      pieces: [...split.pieces, ...resolved.flatMap((r) => openingPiece(r, family))],
      warnings: [
        ...split.issues.map((issue) => wallWarning(run.id, issue.segment, issueMessage(issue))),
        ...warnings,
      ],
      openings: resolved,
    };
  } else {
    const unknown = wallWarning(run.id, null, `Unknown wall family "${run.familyId}"`);
    result = { pieces: [], warnings: [unknown, ...warnings], openings: resolved };
  }
  wallCache.set(run, { family, openings, result });
  return result;
};

/** Every wall's pieces (openings included), warnings and resolved openings. */
export const deriveWalls = (plan: Plan, lib: Library): WallsResult => {
  const byWall = new Map<WallId, Opening[]>();
  for (const opening of Object.values(plan.openings)) {
    byWall.set(opening.wallId, [...(byWall.get(opening.wallId) ?? []), opening]);
  }
  const results = Object.values(plan.walls).map((run) =>
    deriveWall(run, byWall.get(run.id) ?? [], lib)
  );
  return {
    pieces: results.flatMap((r) => r.pieces),
    warnings: results.flatMap((r) => r.warnings),
    openings: results.flatMap((r) => r.openings),
  };
};
