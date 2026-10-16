import { useActiveToolId } from '../store/hooks';

import { getTool } from './toolbox';

/** The active tool's screen-space overlay content. */
export const ToolPreview = () => {
  const { Preview } = getTool(useActiveToolId());
  return Preview ? <Preview /> : null;
};

/** The active tool's world-space overlay content. */
export const ToolWorldPreview = () => {
  const { WorldPreview } = getTool(useActiveToolId());
  return WorldPreview ? <WorldPreview /> : null;
};
