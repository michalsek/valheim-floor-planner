import { useAtom, useAtomValue } from 'jotai';

import { isRectangle, roofDraftAtom, roofSettingsAtom } from './roofState';
import { RoofSettingsFields } from './RoofSettingsFields';

/**
 * The roof tool's settings bar; it says why a shape gets a hip roof. (Click a room,
 * Shift+click its building, or drag a rectangle.)
 */
export const RoofOptions = () => {
  const [settings, setSettings] = useAtom(roofSettingsAtom);
  const draft = useAtomValue(roofDraftAtom);
  const forcedHip = draft !== null && !isRectangle(draft.outline) && settings.kind !== 'hip';
  return (
    <>
      <RoofSettingsFields
        value={settings}
        onChange={(changes) => setSettings((s) => ({ ...s, ...changes }))}
        autoRidge
        rectangular
      />
      {forcedHip && <span>Not a rectangle: hip roof</span>}
    </>
  );
};
