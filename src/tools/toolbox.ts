import { activeToolIdAtom } from '../store/session';

import { rulerTool } from './Ruler/rulerTool';
import { selectTool } from './Select/selectTool';
import { TOOL_IDS, type ToolId } from './toolIds';
import type { Tool, ToolContext } from './types';
import { wallTool } from './Wall/wallTool';

/** Every tool, by id. Adding an id to `TOOL_IDS` without a tool here fails to compile. */
const TOOLS_BY_ID: Record<ToolId, Tool> = {
  select: selectTool,
  wall: wallTool,
  ruler: rulerTool,
};

/** Tools in ToolRail order. */
export const TOOLS: readonly Tool[] = TOOL_IDS.map((id) => TOOLS_BY_ID[id]);

export const getTool = (id: ToolId): Tool => TOOLS_BY_ID[id];

/** Switches tools, letting the old one clean up its transient state first. */
export const setActiveTool = (ctx: ToolContext, id: ToolId): void => {
  const current = ctx.get(activeToolIdAtom);
  if (current === id) return;
  getTool(current).onDeactivate?.(ctx);
  ctx.set(activeToolIdAtom, id);
  getTool(id).onActivate?.(ctx);
};
