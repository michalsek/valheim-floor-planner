/**
 * Display names for resource item ids, in the shape of `RawItems` (`extractCatalogue.ts`)
 * (treated as `unknown` and validated). Unknown ids are shown as they are.
 */
import type { Library } from './library';
import { asRecord, asString } from './parse';

export interface ItemName {
  name: string;
  namePl: string;
}

export const parseItems = (raw: unknown): ReadonlyMap<string, ItemName> =>
  new Map(
    Object.entries(asRecord(raw, '$')).map(([id, value]) => {
      const item = asRecord(value, `$.${id}`);
      const name = asString(item.name, `$.${id}.name`);
      return [id, { name, namePl: asString(item.namePl, `$.${id}.namePl`) }];
    })
  );

export const itemLabel = (lib: Pick<Library, 'items'>, id: string): string =>
  lib.items.get(id)?.name ?? id;
