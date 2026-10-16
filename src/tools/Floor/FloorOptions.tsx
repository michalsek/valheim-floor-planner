import { useAtom } from 'jotai';

import { floorFamilyIdAtom } from '../../store/session';

import { FloorSettingsFields } from './FloorSettingsFields';

/** The floor tool's settings bar. */
export const FloorOptions = () => {
  const [familyId, setFamilyId] = useAtom(floorFamilyIdAtom);
  return <FloorSettingsFields familyId={familyId} onChange={setFamilyId} />;
};
