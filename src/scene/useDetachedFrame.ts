import { useFrame, type RootState } from '@react-three/fiber';
import { useLayoutEffect, useState } from 'react';

type FrameCallback = (state: RootState, delta: number) => void;

/** Where the component's current callback is, and the function r3f subscribes. */
interface FrameBox {
  target: FrameCallback | null;
  forward: FrameCallback;
}

/** Made outside any component, so `forward`'s closure holds only the box. */
const frameBox = (): FrameBox => {
  const box: FrameBox = { target: null, forward: (state, delta) => box.target?.(state, delta) };
  return box;
};

const point = (box: FrameBox, target: FrameCallback | null) => {
  box.target = target;
};

/**
 * `useFrame` for callbacks that hold large data (a site's tiles, its grid). r3f keeps
 * the subscriber list of its first state snapshot, which can outlive a component's
 * unsubscribe; the subscribed function here only reaches a box that is emptied on
 * unmount, so a stale entry keeps nothing of the component alive.
 */
export const useDetachedFrame = (callback: FrameCallback): void => {
  const [box] = useState(frameBox);
  useLayoutEffect(() => point(box, callback));
  useLayoutEffect(() => () => point(box, null), [box]);
  useFrame(box.forward);
};
