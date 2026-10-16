import { useAtomValue } from 'jotai';

import { OpeningSymbol } from '../../overlay/OpeningSymbols';
import styles from '../../overlay/Overlay.module.css';

import { openingDefAtom, openingHoverAtom } from './openingState';

/** The opening a click would place: green where it fits, red where it doesn't. */
export const OpeningWorldPreview = () => {
  const placement = useAtomValue(openingHoverAtom);
  const def = useAtomValue(openingDefAtom);
  if (!placement || !def) return null;
  return (
    <OpeningSymbol
      kind={def.kind}
      center={placement.stripCenter}
      dir={placement.dir}
      width={def.width}
      className={placement.valid ? styles.openingValid : styles.openingInvalid}
    />
  );
};
