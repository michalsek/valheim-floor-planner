import { Provider } from 'jotai';
import type { ReactNode } from 'react';

import styles from './App.module.css';
import { captureDrop } from './install/dropFolder';
import { dropWorldOnPlanner } from './install/loadWorld';
import { PinnedDimensionLabels3d } from './overlay/DimensionLabel3d';
import { FloorOutlines } from './overlay/FloorOutlines';
import { LevelGhosts } from './overlay/LevelGhosts';
import { LevelTags3d } from './overlay/LevelTags3d';
import { OpeningSymbols } from './overlay/OpeningSymbols';
import { Overlay } from './overlay/Overlay';
import { Overlay3d } from './overlay/Overlay3d';
import { PinnedDimensions } from './overlay/PinnedDimensions';
import { PropFootprints } from './overlay/PropFootprints';
import { PropLabels } from './overlay/PropLabels';
import { RadiusRings } from './overlay/RadiusRings';
import { RawFootprints } from './overlay/RawFootprints';
import { RoofLayer } from './overlay/RoofLayer';
import { RoomLabels } from './overlay/RoomLabels';
import { RoomOutlines } from './overlay/RoomOutlines';
import { SelectionHighlight } from './overlay/SelectionHighlight';
import { SnapCursor } from './overlay/SnapCursor';
import { UnderlayLayer } from './overlay/UnderlayLayer';
import { WallLines } from './overlay/WallLines';
import { PlanCanvas } from './scene/PlanCanvas';
import { useActiveToolId, useViewMode } from './store/hooks';
import { sessionStore } from './store/session';
import type { ToolId } from './tools/toolIds';
import { ToolHost } from './tools/ToolHost';
import { ToolOverlay3d, ToolPreview, ToolWorldPreview } from './tools/ToolPreview';
import { BomPanel } from './ui/BomPanel/BomPanel';
import { BuildPalette } from './ui/BuildPalette/BuildPalette';
import { CatalogBrowser } from './ui/CatalogBrowser/CatalogBrowser';
import { Inspector } from './ui/Inspector/Inspector';
import { LevelsBar } from './ui/LevelsBar/LevelsBar';
import { PlanHeader } from './ui/PlanHeader/PlanHeader';
import { SiteExpandHandles } from './ui/SiteExpand/SiteExpandHandles';
import { StatusStrip } from './ui/StatusStrip/StatusStrip';
import { ToolOptionsBar } from './ui/ToolOptions/ToolOptionsBar';
import { ToolRail } from './ui/ToolRail/ToolRail';
import { useFileDrop } from './ui/shared/useFileDrop';
import { useModelDrop } from './ui/shared/useModelDrop';
import { ViewBar } from './ui/ViewBar/ViewBar';
import { WorldPanel } from './ui/WorldPanel/WorldPanel';

/** The 2D overlay: outlines, labels, rings, dimensions and tool previews. */
const PlanOverlay = () => (
  <Overlay
    world={
      <>
        <LevelGhosts />
        <FloorOutlines />
        <RoomOutlines />
        <WallLines />
        <RawFootprints />
        <PropFootprints />
        <OpeningSymbols />
        <RoofLayer />
        <SelectionHighlight />
        <ToolWorldPreview />
      </>
    }
  >
    <RoomLabels />
    <RadiusRings />
    <PropLabels />
    <PinnedDimensions />
    <ToolPreview />
    <SnapCursor />
  </Overlay>
);

/** The 3D overlay: level heights, dimension lengths and the tool's labels and handles. */
const ViewOverlay3d = () => (
  <Overlay3d>
    <LevelTags3d />
    <PinnedDimensionLabels3d />
    <ToolOverlay3d />
  </Overlay3d>
);

/** The canvas, with (in 2D) the underlay under it, and the view's overlay over it. */
const CanvasLayers = () => {
  const is2d = useViewMode() === '2d';
  return (
    <>
      {/* Before the canvas, so it draws under the grid and walls. */}
      {is2d && <UnderlayLayer />}
      <PlanCanvas />
      {is2d ? <PlanOverlay /> : <ViewOverlay3d />}
    </>
  );
};

/** The tools with a side panel over the canvas edge, and the class keeping bars clear of it. */
const PANEL_CLEARANCE: Partial<Record<ToolId, string | undefined>> = {
  prop: styles.clearCatalogue,
  build: styles.clearPalette,
};

/**
 * Bars over the canvas, outside ToolHost so clicks on them never reach the tool. The
 * catalogue and the Build palette overlay the canvas edge, so the view doesn't jump when
 * they open; the centred bars move over to stay clear of them.
 */
const CanvasChrome = () => {
  const clearance = PANEL_CLEARANCE[useActiveToolId()];
  return (
    <>
      <SiteExpandHandles />
      <CatalogBrowser />
      <BuildPalette />
      <div className={clearance ? `${styles.bars} ${clearance}` : styles.bars}>
        <ToolOptionsBar />
        {useViewMode() === '3d' && <ViewBar />}
      </div>
      <LevelsBar />
    </>
  );
};

/** The canvas area; it takes the game folder when models wait for it. */
const CanvasArea = ({ children }: { children: ReactNode }) => {
  const { dragging, dropProps } = useModelDrop();
  return (
    <div className={styles.canvas} {...dropProps}>
      {children}
      {dragging && <div className={styles.dropHint}>Drop to load the models</div>}
    </div>
  );
};

/**
 * A world folder dropped anywhere on the planner opens the World panel with it (the
 * panel, the install menu and the canvas take their own drops first).
 */
const usePlannerDrop = () =>
  useFileDrop((data) => {
    const drop = captureDrop(data, false);
    if (drop) void dropWorldOnPlanner(drop);
  }).dropProps;

const Shell = ({ children }: { children: ReactNode }) => (
  <div className={styles.app} {...usePlannerDrop()}>
    {children}
  </div>
);

export const App = () => (
  <Provider store={sessionStore}>
    <Shell>
      <div className={styles.rail}>
        <ToolRail />
      </div>
      <CanvasArea>
        <ToolHost>
          <CanvasLayers />
        </ToolHost>
        <CanvasChrome />
      </CanvasArea>
      <div className={styles.side}>
        <PlanHeader />
        <Inspector />
        <BomPanel />
      </div>
      <div className={styles.status}>
        <StatusStrip />
      </div>
      <WorldPanel />
    </Shell>
  </Provider>
);
