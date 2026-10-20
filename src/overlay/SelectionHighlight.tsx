import { useAtomValue } from 'jotai';

import { hitItem } from '../model/hitTest';
import { ITEM_KINDS } from '../model/itemKinds';
import { isSelected, type SelectionItem } from '../model/selection';
import { getLibrary } from '../store/libraryInstance';
import { useLevelPlan } from '../store/planHooks';
import { hoverAtom, selectionAtom } from '../store/selection';
import { supportViewAtom } from '../store/session';

import styles from './Overlay.module.css';
import { RunPath } from './RunPath';

const TONES = {
  selected: { line: styles.selectedLine, halo: styles.selectedHalo },
  hover: { line: styles.hoverLine, halo: undefined },
} as const;

type Tone = keyof typeof TONES;

/**
 * Selected items in the selection colour, and a faint version on the hovered one
 * (world layer, whatever the tool): each item's highlight lines from `ITEM_KINDS`,
 * haloed when selected so they stand apart from same-hued fills. Kinds without
 * highlight lines (dimensions) show their own.
 */
export const SelectionHighlight = () => {
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);
  const plan = useLevelPlan();
  const supportView = useAtomValue(supportViewAtom);

  const hovered = hover && hitItem(hover);
  const items: { item: SelectionItem; tone: Tone }[] = [
    ...(hovered && !isSelected(selection, hovered)
      ? [{ item: hovered, tone: 'hover' as const }]
      : []),
    ...selection.map((item) => ({ item, tone: 'selected' as const })),
  ];

  return (
    <g className={supportView ? styles.supportView : undefined}>
      {items.map(({ item, tone }) => {
        const { line, halo } = TONES[tone];
        const lines = ITEM_KINDS[item.kind].highlight?.(plan, item.id, getLibrary()) ?? [];
        return (
          <g key={`${tone}:${item.kind}:${item.id}`}>
            {halo &&
              lines.map((l, i) => (
                <RunPath key={`halo${i}`} points={l.points} closed={l.closed} className={halo} />
              ))}
            {lines.map((l, i) => (
              <RunPath key={i} points={l.points} closed={l.closed} className={line} />
            ))}
          </g>
        );
      })}
    </g>
  );
};
