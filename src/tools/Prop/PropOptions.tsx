import { useAtomValue } from 'jotai';

import { formatCompact } from '../../format';

import { armedDefAtom, propRotationAtom } from './propState';

/** What the Prop tool places and how it's turned, with the keys that change it. */
export const PropOptions = () => {
  const def = useAtomValue(armedDefAtom);
  const rotation = useAtomValue(propRotationAtom);
  if (!def) return <span>Pick an item in the catalogue</span>;
  return (
    <>
      <span>{def.name}</span>
      <span>{formatCompact(rotation)}°</span>
      <span>R 90° · Shift+R 22.5° · Esc to stop</span>
    </>
  );
};
