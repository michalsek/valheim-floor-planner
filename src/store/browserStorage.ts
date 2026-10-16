/** `window.localStorage`, or null where reading it throws (blocked site data, sandboxes). */
export const getLocalStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};
