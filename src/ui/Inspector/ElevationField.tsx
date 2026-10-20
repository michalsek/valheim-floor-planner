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

interface ElevationFieldProps {
  item: SelectionItem;
  /** The field's name ("Elevation"; a raw piece's is its pivot's "Height"). */
  label?: string;
  /** What the value is, for screen readers. */
  description?: string;
}

/** The height an item stands at, editable (Mod+PageUp / PageDown step it too). */
export const ElevationField = ({
  item,
  label = 'Elevation',
  description = 'Elevation in metres',
}: ElevationFieldProps) => {
  const ctx = useToolContext();
  const step = useAtomValue(cutStepAtom);
  const elevation = ITEM_KINDS[item.kind].elevation(usePlan(), item.id);
  if (elevation === null) return null;
  // Shown to the millimetre; the stored value keeps its precision until edited.
  const shown = Math.round(elevation * 1000) / 1000;
  return (
    <Field label={label} suffix="m">
      <NumberInput
        key={elevation}
        label={description}
        value={shown}
        step={step}
        onCommit={(next) => {
          const cmds = raiseCommands(ctx.plan.getPlan(), [item], next - elevation);
          // The cut rises if the item went above it, as Mod+PageUp does.
          commitCommands(ctx, `Change ${label.toLowerCase()}`, cmds);
        }}
      />
    </Field>
  );
};
