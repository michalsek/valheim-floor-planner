/**
 * Display names for resource item ids, parsed from the game-data extract in
 * `research/valheim-items.json` (the only module that imports it; it is treated as
 * `unknown` and validated). Unknown ids are shown as they are.
 */
import rawItems from '../../research/valheim-items.json';

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

const ITEMS = parseItems(rawItems);

export const itemLabel = (id: string): string => ITEMS.get(id)?.name ?? id;
