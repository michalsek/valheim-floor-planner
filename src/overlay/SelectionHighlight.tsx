import { useAtomValue } from 'jotai';

import { hitItem } from '../model/hitTest';
import { ITEM_KINDS } from '../model/itemKinds';
import { isSelected, type SelectionItem } from '../model/selection';
import { useDisplayDerived, useDisplayPlan } from '../store/planHooks';
import { hoverAtom, selectionAtom } from '../store/selection';

import styles from './Overlay.module.css';
import { PieceFootprints } from './PieceFootprints';
import { RunPath } from './RunPath';

const TONES = {
  selected: { piece: styles.selectedPiece, line: styles.selectedLine },
  hover: { piece: styles.hoverPiece, line: styles.hoverLine },
} as const;

type Tone = keyof typeof TONES;

/**
 * Selected items in the accent colour, and a faint version on the hovered one (world
 * layer, whatever the tool): the pieces derived from each item plus its highlight
 * lines from `ITEM_KINDS`. Kinds without highlight lines (dimensions) show their own.
 */
export const SelectionHighlight = () => {
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const plan = useDisplayPlan();
  const { pieces } = useDisplayDerived();

  const hovered = hover && hitItem(hover);
  const items: { item: SelectionItem; tone: Tone }[] = [
    ...(hovered && !isSelected(selection, hovered)
      ? [{ item: hovered, tone: 'hover' as const }]
      : []),
    ...selection.map((item) => ({ item, tone: 'selected' as const })),
  ];

  return (
    <g>
      {items.map(({ item, tone }) => {
        const { piece, line } = TONES[tone];
        const lines = ITEM_KINDS[item.kind].highlight?.(plan, item.id) ?? [];
        return (
          <g key={`${tone}:${item.kind}:${item.id}`}>
            <PieceFootprints
              pieces={pieces.filter((p) => p.sourceId === item.id)}
              className={piece}
            />
            {lines.map((l, i) => (
              <RunPath key={i} points={l.points} closed={l.closed} className={line} />
            ))}
          </g>
        );
      })}
    </g>
  );
};
