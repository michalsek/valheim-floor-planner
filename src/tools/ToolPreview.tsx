import { atom, useAtomValue } from 'jotai';

import { SnapCursor } from '../overlay/SnapCursor';
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

const NEVER = atom(false);

/** The 2D snap cross, unless the active tool's ghost is the cursor (`Tool.hidesCursor`). */
export const ToolSnapCursor = () => {
  const { hidesCursor } = getTool(useActiveToolId());
  return useAtomValue(hidesCursor ?? NEVER) ? null : <SnapCursor />;
};
