/**
 * Tiny runtime validators for `parseCatalog`. They throw with the offending path
 * so a broken data file fails loudly at start-up.
 */
export const fail = (path: string, expected: string): never => {
  throw new Error(`Invalid catalogue at ${path}: expected ${expected}`);
};

export const asRecord = (value: unknown, path: string): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail(path, 'an object');

export const asArray = (value: unknown, path: string): unknown[] =>
  Array.isArray(value) ? value : fail(path, 'an array');

export const asNumber = (value: unknown, path: string): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fail(path, 'a number');

export const asString = (value: unknown, path: string): string =>
  typeof value === 'string' ? value : fail(path, 'a string');

export const asNullable = <T>(
  value: unknown,
  path: string,
  parse: (v: unknown, p: string) => T
): T | null => (value === null ? null : parse(value, path));

type NumberTuple<N extends number, T extends number[] = []> = T['length'] extends N
  ? T
  : NumberTuple<N, [...T, number]>;

/** An array of exactly `length` numbers, typed as a tuple. */
export const asNumbers = <N extends number>(
  value: unknown,
  path: string,
  length: N
): NumberTuple<N> => {
  const items = asArray(value, path);
  if (items.length !== length) fail(path, `${length} numbers`);
  return items.map((item, i) => asNumber(item, `${path}[${i}]`)) as NumberTuple<N>;
};
