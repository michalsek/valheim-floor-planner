import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { Field } from '../../controls/Field';
import { Select } from '../../controls/Select';
import { formatSize } from '../../format';
import { EPS } from '../../model/geometry/polyline';
import { getLibrary } from '../../store/libraryInstance';
import { openingFamilyAtom, openingPrefabAtom } from '../../store/session';

import { openingChoicesAtom, openingDefAtom, openingHoverAtom } from './openingState';

const familyOptions = () =>
  [...getLibrary().wallFamilies.values()].map((f) => ({ value: f.id, label: f.label }));

/**
 * The opening picker: which family's openings to list (it follows hovered walls that
 * have their own), and the opening. Options wider than the hovered segment can take
 * are disabled.
 */
export const OpeningOptions = () => {
  const [familyId, setFamilyId] = useAtom(openingFamilyAtom);
  const setPrefab = useSetAtom(openingPrefabAtom);
  const choices = useAtomValue(openingChoicesAtom);
  const def = useAtomValue(openingDefAtom);
  const room = useAtomValue(openingHoverAtom)?.room ?? Infinity;

  return (
    <>
      <Field label="For">
        <Select
          label="Wall family"
          options={familyOptions()}
          value={familyId}
          onChange={setFamilyId}
        />
      </Field>
      <Field label="Opening">
        <Select
          label="Opening"
          options={choices.map((d) => ({
            value: d.prefab,
            label: `${d.label} · ${formatSize(d.width, d.height)} m`,
            disabled: d.width > room + EPS,
          }))}
          value={def?.prefab ?? ''}
          onChange={setPrefab}
        />
      </Field>
    </>
  );
};
