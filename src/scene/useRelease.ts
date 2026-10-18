import { useEffect } from 'react';

/** How many mounted components hold each resource. */
const holders = new WeakMap<object, number>();

/**
 * Frees `value` with `release` once no mounted component holds it: when the component
 * unmounts or `value` is replaced. StrictMode's simulated unmount remounts at once, in
 * the same commit, so the count is back up before the check (a microtask later) and the
 * resource the next frame draws is not freed under it. `release` should be stable (a
 * module-level function).
 */
export const useRelease = <T extends object>(value: T, release: (value: T) => void): void => {
  useEffect(() => {
    holders.set(value, (holders.get(value) ?? 0) + 1);
    return () => {
      holders.set(value, (holders.get(value) ?? 1) - 1);
      queueMicrotask(() => {
        if (holders.get(value) === 0) {
          holders.delete(value);
          release(value);
        }
      });
    };
  }, [value, release]);
};
