/**
 * Snap-move (M17 §2.10): a drag of a selection made only of raw pieces carries it as a
 * ghost set about the grabbed piece, placed by the Build tool's rules (ray, push-out,
 * snap, duplicate rule) against everything else; the wheel and R turn it about the
 * grabbed piece's pivot; Shift (pressed once the drag is going) or Alt places freely.
 * The pieces are previewed where they would go through `editPreviewAtom`, each keeping
 * its own level (elevation), and the release commits them as one entry.
 */
import { rawPose, setFromRaw, type GhostSet } from '../../model/build/ghostSet';
import { ROTATION_STEP } from '../../model/build/placement';
import type { PlanCommand } from '../../model/commands';
import { normalizeDeg } from '../../model/geometry/propGeometry';
import type { Selection } from '../../model/selection';
import type { Plan, RawPiece, RawPieceId } from '../../model/types';
import { editPreviewAtom } from '../../store/selection';
import type { ScreenPoint } from '../../viewport/viewportMath';
import { ghostFor, type BuildGhost } from '../Build/buildGhost';
import { wheelSteps } from '../Build/buildWheel';
import type { ToolContext } from '../types';

export interface Carry {
  set: GhostSet;
  /** The carried pieces, in set order (the grabbed one first). */
  ids: readonly RawPieceId[];
  /** Their box keys, left out of hits, snaps and support. */
  exclude: ReadonlySet<string>;
  /** Each piece's elevation, kept by the move (set order). */
  elevations: readonly number[];
  /** The grabbed piece's yaw when picked up, and the turn added since (degrees). */
  yaw: number;
  turn: number;
  /** Shift was down when the drag started (it selected, so it doesn't free the move). */
  shiftHeld: boolean;
  /** Wheel travel short of a step. */
  wheelRest: number;
  /** The pointer last heard, to redo the ghost after a turn. */
  last: { screen: ScreenPoint; alt: boolean; shift: boolean } | null;
  /** Where it would go now; null when the ray lands nowhere. */
  ghost: BuildGhost | null;
}

/** The raw pieces of a selection made only of raw pieces; null for any other selection. */
const rawOnly = (plan: Plan, items: Selection): RawPiece[] | null => {
  if (items.length === 0 || items.some((item) => item.kind !== 'raw')) return null;
  const pieces = items.flatMap((item) => plan.rawPieces[item.id] ?? []);
  return pieces.length === items.length ? pieces : null;
};

/** Whether a selection is raw pieces only (snap-move and Mod+D carry apply). */
export const isRawOnly = (plan: Plan, items: Selection): boolean => rawOnly(plan, items) !== null;

/** A carry of `items` about the piece `grabbed`; null unless they are all raw pieces. */
export const startCarry = (
  plan: Plan,
  items: Selection,
  grabbed: RawPieceId,
  shiftHeld: boolean
): Carry | null => {
  const pieces = rawOnly(plan, items);
  const anchor = pieces?.find((piece) => piece.id === grabbed);
  if (!pieces || !anchor) return null;
  const ordered = [anchor, ...pieces.filter((piece) => piece !== anchor)];
  return {
    set: setFromRaw(pieces, grabbed),
    ids: ordered.map((piece) => piece.id),
    exclude: new Set(ordered.map((piece) => `raw:${piece.id}`)),
    elevations: ordered.map((piece) => piece.elevation),
    yaw: rawPose(anchor).yaw,
    turn: 0,
    shiftHeld,
    wheelRest: 0,
    last: null,
    ghost: null,
  };
};

/** The pieces moved to the ghost, each on its own level. */
const carryCommands = (carry: Carry, ghost: BuildGhost): PlanCommand[] =>
  ghost.placed.map((placed, i) => {
    const elevation = carry.elevations[i]!;
    const y = Math.round((placed.pivot.y - elevation) * 1e6) / 1e6 + 0;
    return {
      type: 'raw.patch',
      id: carry.ids[i]!,
      changes: { position: { x: placed.pivot.x, y, z: placed.pivot.z }, rotation: placed.rotation },
    };
  });

/**
 * The carry with the pointer at `screen`: its ghost and the preview. A blocked pose (it
 * would duplicate a piece) or a ray landing nowhere keeps the last preview.
 */
export const carryTo = (
  ctx: ToolContext,
  carry: Carry,
  pointer: { screen: ScreenPoint; alt: boolean; shift: boolean }
): Carry => {
  // Shift held since the press selected; it frees the move only once pressed again.
  const shiftHeld = carry.shiftHeld && pointer.shift;
  const ghost = ghostFor(ctx.get, {
    set: carry.set,
    yaw: normalizeDeg(carry.yaw + carry.turn),
    manual: null,
    free: pointer.alt || (pointer.shift && !shiftHeld),
    screen: pointer.screen,
    plan: ctx.plan.getPlan(),
    exclude: carry.exclude,
  });
  if (ghost && !ghost.blockedBy) ctx.set(editPreviewAtom, carryCommands(carry, ghost));
  return { ...carry, shiftHeld, last: pointer, ghost };
};

/** The carry turned by `degrees` about the grabbed piece's pivot (redrawn where it is). */
export const turnCarry = (ctx: ToolContext, carry: Carry, degrees: number): Carry => {
  const turned = { ...carry, turn: normalizeDeg(carry.turn + degrees) };
  return turned.last ? carryTo(ctx, turned, turned.last) : turned;
};

/** The carry after a wheel event: 22.5° a notch, wheel up clockwise. */
export const wheelCarry = (ctx: ToolContext, carry: Carry, e: WheelEvent): Carry => {
  const { steps, rest } = wheelSteps(carry.wheelRest, e);
  const next = { ...carry, wheelRest: rest };
  return steps === 0 ? next : turnCarry(ctx, next, steps * ROTATION_STEP);
};
