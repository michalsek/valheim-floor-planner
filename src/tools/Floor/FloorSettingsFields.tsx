import { floorFamilies } from '../../catalog';
import { Field } from '../../controls/Field';
import { Select } from '../../controls/Select';

const FAMILY_OPTIONS = floorFamilies.map((f) => ({ value: f.id, label: f.label }));

interface FloorSettingsFieldsProps {
  familyId: string;
  onChange(familyId: string): void;
}

/** The floor family. Presentational: the floor tool and the Inspector bind it. */
export const FloorSettingsFields = ({ familyId, onChange }: FloorSettingsFieldsProps) => (
  <Field label="Family">
    <Select label="Floor family" options={FAMILY_OPTIONS} value={familyId} onChange={onChange} />
  </Field>
);
