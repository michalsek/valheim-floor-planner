import { useAtomValue, useStore } from 'jotai';

import { wallPreviewAtom } from './wallPreviewAtom';
import { WallSettingsFields } from './WallSettingsFields';
import { flipWallSide, updateWallSettings, wallSettingsAtom } from './wallState';

/**
 * The wall tool's settings bar. While a click would close a loop it shows the side
 * the committed (clockwise) loop gets, as inside/outside; otherwise left/right of the
 * drawing direction.
 */
export const WallOptions = () => {
  const store = useStore();
  const settings = useAtomValue(wallSettingsAtom);
  const preview = useAtomValue(wallPreviewAtom);
  const closingRun = preview?.canClose ? preview.run : null;

  return (
    <WallSettingsFields
      value={closingRun ? { ...settings, side: closingRun.side } : settings}
      loop={closingRun !== null}
      sideHint="(F)"
      onChange={({ side, ...rest }) => {
        updateWallSettings(store, rest);
        // The shown side may be the reoriented one, so treat a side change as a flip.
        if (side !== undefined) flipWallSide(store);
      }}
    />
  );
};
