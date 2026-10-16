import { nearestWallHeight, wallHeightOptions } from '../../catalog/wallFamilies';
import { Button } from '../../controls/Button';
import { Field } from '../../controls/Field';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { Select } from '../../controls/Select';
import { formatNumber } from '../../format';
import type { WallSide } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';

import type { WallSettings } from './wallDraft';

/** How a strip side reads: inside/outside on a (clockwise) loop, else left/right. */
export const describeSide = (side: WallSide, loop: boolean): string =>
  loop ? (side === 'right' ? 'inside' : 'outside') : side;

const familyOptions = () =>
  [...getLibrary().wallFamilies.values()].map((f) => ({ value: f.id, label: f.label }));

interface WallSettingsFieldsProps {
  value: WallSettings;
  /** A family change arrives with the height already snapped to one it can build. */
  onChange(changes: Partial<WallSettings>): void;
  /** Label the side inside/outside (a clockwise loop) rather than left/right. */
  loop: boolean;
  /** Hint after the side, e.g. the tool's shortcut. */
  sideHint?: string;
}

/**
 * Family, height and (block walls only) strip side. Presentational: the wall tool
 * binds it to its settings, the Inspector to a selected wall.
 */
export const WallSettingsFields = ({
  value,
  onChange,
  loop,
  sideHint,
}: WallSettingsFieldsProps) => {
  const family = getLibrary().wallFamilies.get(value.familyId);
  const flipped: WallSide = value.side === 'right' ? 'left' : 'right';

  return (
    <>
      <Field label="Family">
        <Select
          label="Wall family"
          options={familyOptions()}
          value={value.familyId}
          onChange={(familyId) => {
            const next = getLibrary().wallFamilies.get(familyId);
            if (next) onChange({ familyId, height: nearestWallHeight(next, value.height) });
          }}
        />
      </Field>
      {family && (
        <Field label="Height" suffix="m">
          <SegmentedControl
            label="Wall height"
            options={wallHeightOptions(family).map((h) => ({
              value: h,
              label: formatNumber(h, Number.isInteger(h) ? 0 : 1),
            }))}
            value={value.height}
            onChange={(height) => onChange({ height })}
          />
        </Field>
      )}
      {family?.snapKind === 'face' && (
        <Button
          title="Which side of the line the 1 m block strip fills"
          onClick={() => onChange({ side: flipped })}
        >
          Strip: {describeSide(value.side, loop)}
          {sideHint && ` ${sideHint}`}
        </Button>
      )}
    </>
  );
};
