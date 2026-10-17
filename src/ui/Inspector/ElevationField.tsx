import { useAtomValue } from 'jotai';

import { Field } from '../../controls/Field';
import { NumberInput } from '../../controls/NumberInput';
import { ITEM_KINDS } from '../../model/itemKinds';
import { shiftElevation } from '../../model/levels';
import type { SelectionItem } from '../../model/selection';
import { usePlan } from '../../store/planHooks';
import { elevationStepAtom } from '../../store/session';
import { setWorkElevation } from '../../tools/levelActions';
import { commitCommands } from '../../tools/Select/selectActions';
import { useToolContext } from '../../tools/toolContext';

/** The level an item stands on, editable (Mod+PageUp / PageDown step it too). */
export const ElevationField = ({ item }: { item: SelectionItem }) => {
  const ctx = useToolContext();
  const step = useAtomValue(elevationStepAtom);
  const elevation = ITEM_KINDS[item.kind].elevation(usePlan(), item.id);
  if (elevation === null) return null;
  return (
    <Field label="Elevation" suffix="m">
      <NumberInput
        key={elevation}
        label="Elevation in metres"
        value={elevation}
        step={step}
        onCommit={(next) => {
          const plan = ctx.plan.getPlan();
          const cmds = shiftElevation(plan, [item], next - elevation);
          // The current level follows the item, as Mod+PageUp does.
          if (commitCommands(ctx, 'Change elevation', cmds)) setWorkElevation(ctx, next);
        }}
      />
    </Field>
  );
};
