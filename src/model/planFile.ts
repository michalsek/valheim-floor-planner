/**
 * Plans as file JSON (version 6): the plan as it is, but for its site's heights, packed
 * (`heightPacking.ts`). Reading takes any version `parsePlan` does: version 6 heights are
 * unpacked first, version 5's base64 is decoded by `parsePlan`. Pure, but asynchronous
 * (the packing streams through `CompressionStream`).
 */
import { parsePlan, PlanParseError } from './serialize';
import { isPackedHeights, packHeights, unpackHeights } from './terrain/heightPacking';
import { MAX_SITE_SIDE } from './terrain/sitePatch';
import type { Plan } from './types';

/** The plan as file JSON; `extras` adds top-level fields (a file's embedded image). */
export const planFileText = async (
  plan: Plan,
  extras: Record<string, unknown> = {}
): Promise<string> => {
  const frame = plan.importFrame;
  const terrain = frame?.terrain;
  const file = terrain
    ? {
        ...plan,
        importFrame: {
          ...frame,
          terrain: { ...terrain, heights: await packHeights(terrain.heights, terrain.cols) },
        },
      }
    : plan;
  return JSON.stringify({ ...file, ...extras });
};

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const side = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 2 && n <= MAX_SITE_SIDE + 1;

/**
 * A plan from parsed file JSON (or the localStorage autosave's), validated by
 * `parsePlan`; throws a `PlanParseError` when it isn't one.
 */
export const readPlanJson = async (raw: unknown): Promise<Plan> => {
  const root = record(raw);
  const frame = record(root?.importFrame);
  const terrain = record(frame?.terrain);
  if (!root || !frame || !terrain || !isPackedHeights(terrain.heights)) return parsePlan(raw);
  const path = '$.importFrame.terrain.heights';
  const { cols, rows } = terrain;
  // Unpacked only into a patch the plan may have, so a file can't ask for a huge buffer.
  if (!side(cols) || !side(rows)) return parsePlan(raw);
  let heights: Int16Array;
  try {
    heights = await unpackHeights(terrain.heights, cols, rows);
  } catch {
    throw new PlanParseError(path, `packed heights of ${cols} × ${rows} vertices`);
  }
  return parsePlan({ ...root, importFrame: { ...frame, terrain: { ...terrain, heights } } });
};
