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

/** The active tool's 3D scene content (inside the canvas). */
export const ToolPreview3d = () => {
  const { Preview3d } = getTool(useActiveToolId());
  return Preview3d ? <Preview3d /> : null;
};

/** The active tool's 3D overlay content (screen px). */
export const ToolOverlay3d = () => {
  const { Overlay3d } = getTool(useActiveToolId());
  return Overlay3d ? <Overlay3d /> : null;
};
