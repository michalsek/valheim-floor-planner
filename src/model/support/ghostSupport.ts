/**
 * The support a piece (or a carried set) would get if placed now, without a recompute:
 * each ghost body finds its neighbours among the committed plan's (by collider contact
 * and snap joints), takes their published values from the committed result, and runs
 * one relaxation step of the solver's rule (`supportOfBody`). A set's bodies also rest
 * on each other, so they relax among themselves a few times (monotone, a handful of
 * bodies). What the new piece would add to others' support is ignored, as the game
 * shows the value on placement too. Pure.
 */
import { boxSnapPoints } from '../build/snapPoints';
import type { PieceBox } from '../pieceBoxes';

import { MIN_CONTACT_FACE, touching } from './contacts';
import {
  boxSupportOf,
  bodyOf,
  type BoxSupport,
  type PlanSupport,
  type SupportModel,
} from './planSupport';
import { supportOfBody, type Giver, type SupportBody } from './propagate';
import { boxShape, type SupportShape } from './shape';
import { jointsAt, SNAP_JOINT, type SnapJointIndex } from './snapJoints';

/** What a ghost's support is worked out against: one commit's model and snap joints. */
export interface CommittedIndex {
  model: SupportModel;
  joints: SnapJointIndex;
}

/** A rise smaller than this ends the set's relaxation. */
const RELAX = 1e-3;

interface Ghost {
  shape: SupportShape;
  body: SupportBody;
  /** The committed neighbours, with their published values. */
  committed: Giver[];
  /** The other ghosts it rests on (indices into the set). */
  set: number[];
}

const published = (support: BoxSupport | undefined): number =>
  !support || support.state === 'collapsing' || support.state === 'none' ? 0 : support.value;

const jointed = (a: readonly PieceBox['pivot'][], b: readonly PieceBox['pivot'][]): boolean =>
  a.some((p) =>
    b.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 <= SNAP_JOINT ** 2)
  );

/**
 * The support of each ghost box, in order. `support` is the committed result for the
 * model's plan; `exclude` names committed boxes (by key) left out, the pieces being
 * carried.
 */
export const ghostSupport = (
  ghosts: readonly PieceBox[],
  { model, joints }: CommittedIndex,
  support: PlanSupport,
  exclude: ReadonlySet<string> = new Set()
): BoxSupport[] => {
  const eps = model.index.eps;
  const snaps = ghosts.map((box) => boxSnapPoints(box, joints.lib));
  const set: Ghost[] = ghosts.map((box, g) => {
    const shape = boxShape(box);
    const near = new Set([...touching(model.index, shape), ...jointsAt(joints, snaps[g]!)]);
    const committed = [...near].flatMap((j): Giver[] => {
      const other = model.boxes[j]!;
      if (exclude.has(other.key)) return [];
      const point = model.shapes[j]!.closestPoint(shape.com);
      return [
        { body: model.bodies[j]!, published: published(support.byKey.get(other.key)), point },
      ];
    });
    const body = bodyOf(box, shape, model.materials, model.groundUnder);
    return { shape, body, committed, set: [] };
  });
  set.forEach((a, g) => {
    set.forEach((b, h) => {
      if (g === h) return;
      if (a.shape.touches(b.shape, eps, MIN_CONTACT_FACE) || jointed(snaps[g]!, snaps[h]!)) {
        a.set.push(h);
      }
    });
  });

  // Jacobi passes from nothing: values only rise, and a chain of n settles in n passes.
  const holds = set.map(() => 0);
  let results = set.map((ghost) => supportOfBody(ghost.body, ghost.committed));
  for (let pass = 0; pass < set.length; pass++) {
    const rose = results.map((r, g) => {
      const next = r.state === 'collapsing' || r.state === 'none' ? 0 : r.value;
      const up = next > holds[g]! + RELAX;
      holds[g] = Math.max(holds[g]!, next);
      return up;
    });
    if (!rose.some(Boolean) || set.length === 1) break;
    results = set.map((ghost) =>
      supportOfBody(ghost.body, [
        ...ghost.committed,
        ...ghost.set.map((h): Giver => ({
          body: set[h]!.body,
          published: holds[h]!,
          point: set[h]!.shape.closestPoint(ghost.shape.com),
        })),
      ])
    );
  }
  return set.map((ghost, g) =>
    boxSupportOf(ghost.body.material, results[g]!.value, results[g]!.state)
  );
};
