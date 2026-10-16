/**
 * The game's localization table: an RFC 4180 CSV (quoted cells may span lines and
 * escape quotes as `""`) with the key in the first column and one column per
 * language, found by its header. Only English and Polish are kept.
 */
import { GameDataError } from '../GameDataError';

export interface Localization {
  en: ReadonlyMap<string, string>;
  pl: ReadonlyMap<string, string>;
}

/** Calls `onRow` with the cells of each record. */
const forEachRecord = (csv: string, onRow: (cells: string[]) => void): void => {
  const n = csv.length;
  let i = 0;
  let row: string[] = [];
  while (i < n) {
    let cell: string;
    if (csv[i] === '"') {
      cell = '';
      let from = i + 1;
      for (;;) {
        const quote = csv.indexOf('"', from);
        if (quote < 0) {
          cell += csv.slice(from);
          i = n;
          break;
        }
        cell += csv.slice(from, quote);
        if (csv[quote + 1] === '"') {
          cell += '"';
          from = quote + 2;
        } else {
          i = quote + 1;
          break;
        }
      }
      // Be lenient about stray characters after a closing quote.
      while (i < n && csv[i] !== ',' && csv[i] !== '\n' && csv[i] !== '\r') i++;
    } else {
      const start = i;
      while (i < n && csv[i] !== ',' && csv[i] !== '\n' && csv[i] !== '\r') i++;
      cell = csv.slice(start, i);
    }
    row.push(cell);

    if (csv[i] === ',') {
      i++;
      if (i === n) row.push('');
      else continue;
    }
    onRow(row);
    row = [];
    if (csv[i] === '\r') i++;
    if (csv[i] === '\n') i++;
  }
};

export const parseLocalization = (csv: string): Localization => {
  const en = new Map<string, string>();
  const pl = new Map<string, string>();
  let columns: { en: number; pl: number } | null = null;

  forEachRecord(csv.replace(/^\uFEFF/, ''), (cells) => {
    if (!columns) {
      columns = { en: cells.indexOf('English'), pl: cells.indexOf('Polish') };
      if (columns.en < 1 || columns.pl < 1) {
        throw new GameDataError('unsupported', 'localization has no English/Polish columns');
      }
      return;
    }
    const key = cells[0];
    if (!key) return;
    const english = cells[columns.en];
    const polish = cells[columns.pl];
    if (english) en.set(key, english);
    if (polish) pl.set(key, polish);
  });
  return { en, pl };
};
