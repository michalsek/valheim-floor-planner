/**
 * The selection model: which plan objects are selected. Pure (the Jotai atom lives in
 * `store/selection.ts`). Per-kind facts come from `ITEM_KINDS`; a new kind adds a
 * member to `SelectionItem` and an entry there.
 */
import { ITEM_KINDS, SELECTION_KINDS } from './itemKinds';
import type { DimId, FloorId, OpeningId, Plan, PropId, WallId } from './types';

export type SelectionItem =
  | { kind: 'wall'; id: WallId }
  | { kind: 'opening'; id: OpeningId }
  | { kind: 'floor'; id: FloorId }
  | { kind: 'dimension'; id: DimId }
  | { kind: 'prop'; id: PropId };

export type SelectionKind = SelectionItem['kind'];

/** Selected items in selection order; the first is the primary one. */
export type Selection = readonly SelectionItem[];

const itemKey = (item: SelectionItem): string => `${item.kind}:${item.id}`;

const sameItem = (a: SelectionItem, b: SelectionItem): boolean =>
  a.kind === b.kind && a.id === b.id;

const idsOf = (plan: Plan, kind: SelectionKind): string[] =>
  Object.keys(ITEM_KINDS[kind].collection(plan));

export const itemExists = (plan: Plan, item: SelectionItem): boolean =>
  Object.hasOwn(ITEM_KINDS[item.kind].collection(plan), item.id);

export const isSelected = (selection: Selection, item: SelectionItem): boolean =>
  selection.some((s) => sameItem(s, item));

/** Every object in the plan, as items. */
export const allItems = (plan: Plan): SelectionItem[] =>
  SELECTION_KINDS.flatMap((kind) => idsOf(plan, kind).map((id): SelectionItem => ({ kind, id })));

export const isPlanEmpty = (plan: Plan): boolean =>
  SELECTION_KINDS.every((kind) => idsOf(plan, kind).length === 0);

/** The wall whose corners show drag handles: the only selected item, if it's a wall. */
export const handleWallId = (selection: Selection): WallId | null => {
  const [only] = selection;
  return selection.length === 1 && only?.kind === 'wall' ? only.id : null;
};

/**
 * Drops items that no longer exist and repeats (keeping the first). Returns the same
 * array when nothing changed, so an unchanged selection doesn't re-render anything.
 */
export const normalizeSelection = (plan: Plan, selection: Selection): Selection => {
  const seen = new Set<string>();
  const kept = selection.filter((item) => {
    const key = itemKey(item);
    if (seen.has(key) || !itemExists(plan, item)) return false;
    seen.add(key);
    return true;
  });
  return kept.length === selection.length ? selection : kept;
};

/** Adds `item`, or removes it when it is already selected. */
export const toggleItem = (selection: Selection, item: SelectionItem): Selection =>
  isSelected(selection, item) ? selection.filter((s) => !sameItem(s, item)) : [...selection, item];

/** `selection` plus the `items` it doesn't have yet, in order. */
export const unionItems = (selection: Selection, items: readonly SelectionItem[]): Selection => {
  const added = items.filter(
    (item, i) => !isSelected(selection, item) && items.findIndex((o) => sameItem(o, item)) === i
  );
  return added.length === 0 ? selection : [...selection, ...added];
};

/** "Move wall" for one item, "Move 3 items" for several. */
export const itemsLabel = (verb: string, items: Selection): string => {
  const [first] = items;
  if (items.length === 1 && first) return `${verb} ${ITEM_KINDS[first.kind].noun}`;
  return `${verb} ${items.length} items`;
};
