import type { Library } from '../catalog/library';

import { computeBom, type Bom } from './bom';
import type { Plan, PlanWarning } from './types';

/** Everything computed from the plan; never stored. */
export interface Derived {
  bom: Bom;
  warnings: PlanWarning[];
}

/** Props whose prefab isn't in the catalogue (from a hand-edited or newer file). */
const propWarnings = (plan: Plan, lib: Library): PlanWarning[] =>
  Object.values(plan.props).flatMap((prop): PlanWarning[] =>
    lib.propDefs.has(prop.prefab)
      ? []
      : [
          {
            source: { kind: 'prop', id: prop.id },
            message: `Unknown item ${prop.prefab}`,
          },
        ]
  );

/** Raw pieces whose prefab isn't in the catalogue (a world of a newer game build). */
const rawWarnings = (plan: Plan, lib: Library): PlanWarning[] =>
  Object.values(plan.rawPieces).flatMap((piece): PlanWarning[] =>
    lib.catalog.pieces.has(piece.prefab)
      ? []
      : [
          {
            source: { kind: 'raw', id: piece.id },
            message: `Unknown piece ${piece.prefab}`,
          },
        ]
  );

export const derivePlan = (plan: Plan, lib: Library): Derived => ({
  bom: computeBom([...Object.values(plan.props), ...Object.values(plan.rawPieces)], lib.catalog),
  warnings: [...propWarnings(plan, lib), ...rawWarnings(plan, lib)],
});
