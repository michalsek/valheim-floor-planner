/**
 * Tool ids, kept dependency-free so session state can name tools without importing
 * them. `toolbox.ts` must provide a tool for each id (checked by the compiler).
 */
export const TOOL_IDS = ['select', 'ruler'] as const;

export type ToolId = (typeof TOOL_IDS)[number];
