import { Field } from '../../controls/Field';
import { Select } from '../../controls/Select';
import { getLibrary } from '../../store/libraryInstance';

const familyOptions = () =>
  [...getLibrary().floorFamilies.values()].map((f) => ({ value: f.id, label: f.label }));

interface FloorSettingsFieldsProps {
  familyId: string;
  onChange(familyId: string): void;
}

/** The floor family. Presentational: the floor tool and the Inspector bind it. */
export const FloorSettingsFields = ({ familyId, onChange }: FloorSettingsFieldsProps) => (
  <Field label="Family">
    <Select label="Floor family" options={familyOptions()} value={familyId} onChange={onChange} />
  </Field>
);
