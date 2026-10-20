import { useAtomValue } from 'jotai';

import { Field } from '../../controls/Field';
import { NumberInput } from '../../controls/NumberInput';
import { raiseCommands } from '../../model/cut';
import { ITEM_KINDS } from '../../model/itemKinds';
import type { SelectionItem } from '../../model/selection';
import { usePlan } from '../../store/planHooks';
import { cutStepAtom } from '../../store/session';
import { commitCommands } from '../../tools/commitCommands';
import { useToolContext } from '../../tools/toolContext';

/** What the height is, for screen readers. */
const DESCRIPTIONS: Record<SelectionItem['kind'], string> = {
  raw: "The pivot's height above the plan's 0, in metres",
  prop: 'The height it stands at, in metres',
  dimension: 'The height it is drawn at, in metres',
};

/** The absolute height an item is at, editable (Mod+PageUp / PageDown step it too). */
export const HeightField = ({ item }: { item: SelectionItem }) => {
  const ctx = useToolContext();
  const step = useAtomValue(cutStepAtom);
  const height = ITEM_KINDS[item.kind].elevation(usePlan(), item.id);
  if (height === null) return null;
  // Shown to the millimetre; the stored value keeps its precision until edited.
  const shown = Math.round(height * 1000) / 1000;
  return (
    <Field label="Height" suffix="m">
      <NumberInput
        key={height}
        label={DESCRIPTIONS[item.kind]}
        value={shown}
        step={step}
        onCommit={(next) => {
          const cmds = raiseCommands(ctx.plan.getPlan(), [item], next - height);
          // The cut rises if the item went above it, as Mod+PageUp does.
          commitCommands(ctx, 'Change height', cmds);
        }}
      />
    </Field>
  );
};
