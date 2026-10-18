import { atom, type WritableAtom } from 'jotai';

/** `window.localStorage`, or null where reading it throws (blocked site data, sandboxes). */
export const getLocalStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/**
 * An atom remembered per browser under `key`: read once at start (`fallback` when
 * nothing usable is stored, `parse` returning null), written on every set. Blocked or
 * full storage only makes the value last for the session.
 */
export const persistedAtom = <T>(
  key: string,
  fallback: T,
  parse: (stored: string) => T | null,
  serialize: (value: T) => string
): WritableAtom<T, [T], void> => {
  const read = (): T => {
    try {
      const stored = getLocalStorage()?.getItem(key);
      return (stored == null ? null : parse(stored)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const base = atom<T>(read());
  return atom(
    (get) => get(base),
    (_get, set, value: T) => {
      set(base, value);
      try {
        getLocalStorage()?.setItem(key, serialize(value));
      } catch {
        // The value lasts for this session only.
      }
    }
  );
};
