import { ROOF_PITCHES, type RoofPitch } from '../../catalog/roofFamilies';
import { Field } from '../../controls/Field';
import { SegmentedControl } from '../../controls/SegmentedControl';
import { Select } from '../../controls/Select';
import { ROOF_OVERHANGS } from '../../model/roofs/roofCheck';
import type { Roof, RoofKind, RoofOverhang, RoofSide } from '../../model/types';
import { getLibrary } from '../../store/libraryInstance';

/** The fields a roof and the roof tool share. */
export interface RoofFields {
  familyId: string;
  pitch: RoofPitch;
  kind: RoofKind;
  ridge: 'auto' | 'x' | 'z';
  lowSide: 'auto' | RoofSide;
  eave: RoofOverhang;
  gable: RoofOverhang;
  gableWalls: Roof['gableWalls'];
}

interface RoofSettingsFieldsProps {
  value: RoofFields;
  onChange(changes: Partial<RoofFields>): void;
  /** Offer 'auto' for the ridge (the tool: the long side of what it roofs). */
  autoRidge: boolean;
  /** Gable and shed need a rectangle; without one only hip is offered. */
  rectangular: boolean;
}

const KINDS: readonly { value: RoofKind; label: string }[] = [
  { value: 'gable', label: 'Gable' },
  { value: 'hip', label: 'Hip' },
  { value: 'shed', label: 'Shed' },
];

const familyOptions = () =>
  [...getLibrary().roofFamilies.values()].map((f) => ({ value: f.id, label: f.label }));

const gableWallOptions = () => [
  { value: 'none', label: 'None' },
  ...[...getLibrary().gableWallSets.values()].map((s) => ({ value: s.id, label: s.label })),
];

const overhangOptions = ROOF_OVERHANGS.map((m) => ({ value: m, label: `${m}` }));

/**
 * Family, pitch (those it has), kind, ridge, overhangs and gable walls. Presentational:
 * the roof tool binds it to its settings, the Inspector to a selected roof.
 */
export const RoofSettingsFields = ({
  value,
  onChange,
  autoRidge,
  rectangular,
}: RoofSettingsFieldsProps) => {
  const family = getLibrary().roofFamilies.get(value.familyId);
  const pitches = ROOF_PITCHES.filter((p) => family?.pitches.has(p));
  const kind = rectangular ? value.kind : 'hip';
  const sides = [
    ...(autoRidge ? [{ value: 'auto' as const, label: 'Auto' }] : []),
    ...(['-x', '+x', '-z', '+z'] as const).map((side) => ({
      value: side,
      label: side.replace('-', '−'),
    })),
  ];
  const ridges = [
    ...(autoRidge ? [{ value: 'auto' as const, label: 'Auto' }] : []),
    { value: 'x' as const, label: 'x' },
    { value: 'z' as const, label: 'z' },
  ];
  return (
    <>
      <Field label="Family">
        <Select
          label="Roof family"
          options={familyOptions()}
          value={value.familyId}
          onChange={(familyId) => {
            const next = getLibrary().roofFamilies.get(familyId);
            const pitch = next?.pitches.has(value.pitch)
              ? value.pitch
              : (next?.pitches.keys().next().value ?? value.pitch);
            onChange({ familyId, pitch });
          }}
        />
      </Field>
      <Field label="Pitch" suffix="°">
        <SegmentedControl
          label="Roof pitch"
          options={pitches.map((p) => ({ value: p, label: `${p}` }))}
          value={value.pitch}
          onChange={(pitch) => onChange({ pitch })}
        />
      </Field>
      <Field label="Kind">
        <SegmentedControl
          label="Roof kind"
          options={rectangular ? KINDS : KINDS.filter((k) => k.value === 'hip')}
          value={kind}
          onChange={(next) => onChange({ kind: next })}
        />
      </Field>
      {kind === 'shed' && (
        <Field label="Low side">
          <SegmentedControl
            label="Low side"
            options={sides}
            value={value.lowSide}
            onChange={(lowSide) => onChange({ lowSide })}
          />
        </Field>
      )}
      {kind === 'gable' && (
        <Field label="Ridge">
          <SegmentedControl
            label="Ridge axis"
            options={ridges}
            value={value.ridge}
            onChange={(ridge) => onChange({ ridge })}
          />
        </Field>
      )}
      <Field label="Eave" suffix="m">
        <SegmentedControl
          label="Eave overhang"
          options={overhangOptions}
          value={value.eave}
          onChange={(eave) => onChange({ eave })}
        />
      </Field>
      {kind !== 'hip' && (
        <Field label="Gable" suffix="m">
          <SegmentedControl
            label="Gable overhang"
            options={overhangOptions}
            value={value.gable}
            onChange={(gable) => onChange({ gable })}
          />
        </Field>
      )}
      {kind !== 'hip' && (
        <Field label="Fill">
          <Select
            label="Gable walls"
            options={gableWallOptions()}
            value={value.gableWalls}
            onChange={(gableWalls) => onChange({ gableWalls: gableWalls as Roof['gableWalls'] })}
          />
        </Field>
      )}
    </>
  );
};
