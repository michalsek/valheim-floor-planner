import { useAtomValue } from 'jotai';
import { useMemo } from 'react';

import { propRadius } from '../../catalog/stations';
import { Button } from '../../controls/Button';
import { newId } from '../../model/newId';
import { canExplode, explodeCommands, explodeLabel } from '../../model/pieceOps/explode';
import { mirrorCommands, symmetricAcross, type MirrorAxis } from '../../model/pieceOps/mirror';
import { rawDef } from '../../model/rawPieces';
import type { Plan } from '../../model/types';
import type { SelectionItem } from '../../model/selection';
import { getLibrary } from '../../store/libraryInstance';
import { usePlan } from '../../store/planHooks';
import { selectionAtom } from '../../store/selection';
import { commitCommands } from '../../tools/Select/selectActions';
import { useToolContext } from '../../tools/toolContext';

import styles from './Inspector.module.css';
import { RepeatSection } from './RepeatSection';

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

const EXPLODE_HINT =
  'Turn it into single game pieces, which can then be moved, turned and removed one by one (one undo step)';

/** Whether any selected prop is a station or ward, whose radius ring a raw piece loses. */
const hasRing = (plan: Plan, items: readonly SelectionItem[]): boolean =>
  items.some((item) => {
    const prop = item.kind === 'prop' ? plan.props[item.id] : undefined;
    return prop !== undefined && propRadius(prop.prefab, 0, getLibrary().catalog) !== null;
  });

/** Selected items Explode leaves as they are (an opening goes with its exploded wall). */
const leftOver = (
  plan: Plan,
  items: readonly SelectionItem[],
  explodable: readonly SelectionItem[]
): number =>
  items.filter((item) => {
    if (canExplode(item)) return false;
    const wallId = item.kind === 'opening' ? plan.openings[item.id]?.wallId : undefined;
    return !explodable.some((e) => e.kind === 'wall' && e.id === wallId);
  }).length;

/**
 * How many of the raw pieces Mirror can't mirror exactly: those symmetric across neither
 * local axis (as `mirrorCommands` counts them, per prefab rather than per piece).
 */
const unmirrorable = (plan: Plan, items: readonly SelectionItem[]): number => {
  const asymmetric = new Map<string, boolean>();
  return items.filter((item) => {
    const piece = item.kind === 'raw' ? plan.rawPieces[item.id] : undefined;
    if (!piece) return false;
    let known = asymmetric.get(piece.prefab);
    if (known === undefined) {
      const def = rawDef(getLibrary(), piece);
      known = !symmetricAcross(def, 'x') && !symmetricAcross(def, 'z');
      asymmetric.set(piece.prefab, known);
    }
    return known;
  }).length;
};

const MIRRORS: readonly { axis: MirrorAxis; label: string; title: string }[] = [
  { axis: 'x', label: 'Mirror X', title: 'Flip left and right, about the selection’s centre' },
  {
    axis: 'z',
    label: 'Mirror Z',
    title: 'Flip top and bottom (in plan), about the selection’s centre',
  },
];

/**
 * Edits that change what pieces the selection is made of (M17 §7): Explode for walls,
 * floors, roofs and props (one or several), Mirror X / Z and Repeat for raw pieces. Each
 * is one undo entry. Mirror and Repeat need a selection of raw pieces only.
 */
export const PieceActions = () => {
  const ctx = useToolContext();
  const items = useAtomValue(selectionAtom);
  const plan = usePlan();
  const explodable = useMemo(() => items.filter(canExplode), [items]);
  const raws = useMemo(() => items.filter((item) => item.kind === 'raw'), [items]);
  const rawOnly = raws.length === items.length;
  const inexact = useMemo(() => (rawOnly ? unmirrorable(plan, raws) : 0), [plan, raws, rawOnly]);
  if (explodable.length === 0 && raws.length === 0) return null;

  const explode = () => {
    const result = explodeCommands(ctx.plan.getPlan(), items, getLibrary(), newId);
    // Boxes without a prefab (none in practice) are counted in the history entry.
    const skipped = result.skipped > 0 ? `, ${result.skipped} without a prefab left out` : '';
    if (commitCommands(ctx, explodeLabel(result) + skipped, result.cmds)) {
      ctx.set(selectionAtom, result.items);
    }
  };

  const mirror = (axis: MirrorAxis) => {
    const { cmds } = mirrorCommands(ctx.plan.getPlan(), raws, axis, getLibrary());
    commitCommands(ctx, `Mirror ${axis.toUpperCase()} (${plural(raws.length, 'piece')})`, cmds);
  };

  const explodeTitle = hasRing(plan, explodable)
    ? `${EXPLODE_HINT}. A station loses its radius ring.`
    : EXPLODE_HINT;

  return (
    <div className={styles.actions} role="group" aria-label="Piece actions">
      {explodable.length > 0 && (
        <div className={styles.actionRow}>
          <Button title={explodeTitle} onClick={explode}>
            {explodable.length === 1 ? 'Explode' : `Explode ${explodable.length} items`}
          </Button>
          {leftOver(plan, items, explodable) > 0 && (
            <span className={styles.info}>The rest stays as it is</span>
          )}
        </div>
      )}
      {raws.length > 0 &&
        (rawOnly ? (
          <>
            <div className={styles.actionRow}>
              {MIRRORS.map(({ axis, label, title }) => (
                <Button key={axis} title={title} onClick={() => mirror(axis)}>
                  {label}
                </Button>
              ))}
            </div>
            <RepeatSection key={raws.map((r) => r.id).join()} raws={raws} />
            {inexact > 0 && (
              <p className={styles.info}>
                {plural(inexact, 'piece')} can’t be mirrored exactly:{' '}
                {inexact === 1 ? 'it has' : 'they have'} no mirror symmetry, so{' '}
                {inexact === 1 ? 'it keeps its' : 'they keep their'} way along
              </p>
            )}
          </>
        ) : (
          <p className={styles.info}>
            Mirror and Repeat take raw pieces only: explode the rest first
          </p>
        ))}
    </div>
  );
};
