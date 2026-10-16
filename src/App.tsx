import { Provider } from 'jotai';

import styles from './App.module.css';
import { PinnedDimensionLabels3d } from './overlay/DimensionLabel3d';
import { FloorOutlines } from './overlay/FloorOutlines';
import { OpeningSymbols } from './overlay/OpeningSymbols';
import { Overlay } from './overlay/Overlay';
import { Overlay3d } from './overlay/Overlay3d';
import { PinnedDimensions } from './overlay/PinnedDimensions';
import { PropFootprints } from './overlay/PropFootprints';
import { PropLabels } from './overlay/PropLabels';
import { RadiusRings } from './overlay/RadiusRings';
import { RoomLabels } from './overlay/RoomLabels';
import { RoomOutlines } from './overlay/RoomOutlines';
import { SelectionHighlight } from './overlay/SelectionHighlight';
import { SnapCursor } from './overlay/SnapCursor';
import { UnderlayLayer } from './overlay/UnderlayLayer';
import { WallLines } from './overlay/WallLines';
import { PlanCanvas } from './scene/PlanCanvas';
import { useViewMode } from './store/hooks';
import { sessionStore } from './store/session';
import { ToolHost } from './tools/ToolHost';
import { ToolOverlay3d, ToolPreview, ToolWorldPreview } from './tools/ToolPreview';
import { BomPanel } from './ui/BomPanel/BomPanel';
import { CatalogBrowser } from './ui/CatalogBrowser/CatalogBrowser';
import { Inspector } from './ui/Inspector/Inspector';
import { PlanHeader } from './ui/PlanHeader/PlanHeader';
import { StatusStrip } from './ui/StatusStrip/StatusStrip';
import { ToolOptionsBar } from './ui/ToolOptions/ToolOptionsBar';
import { ToolRail } from './ui/ToolRail/ToolRail';
import { ViewBar } from './ui/ViewBar/ViewBar';

/** The 2D overlay: outlines, labels, rings, dimensions and tool previews. */
const PlanOverlay = () => (
  <Overlay
    world={
      <>
        <FloorOutlines />
        <RoomOutlines />
        <WallLines />
        <PropFootprints />
        <OpeningSymbols />
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

/** The 3D overlay: dimension lengths and the tool's labels and handles. */
const ViewOverlay3d = () => (
  <Overlay3d>
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

/**
 * Bars over the canvas, outside ToolHost so clicks on them never reach the tool. The
 * catalogue overlays the canvas edge, so the view doesn't jump when it opens.
 */
const CanvasChrome = () => (
  <>
    <CatalogBrowser />
    <ToolOptionsBar />
    {useViewMode() === '3d' && <ViewBar />}
  </>
);

export const App = () => (
  <Provider store={sessionStore}>
    <div className={styles.app}>
      <div className={styles.rail}>
        <ToolRail />
      </div>
      <div className={styles.canvas}>
        <ToolHost>
          <CanvasLayers />
        </ToolHost>
        <CanvasChrome />
      </div>
      <div className={styles.side}>
        <PlanHeader />
        <Inspector />
        <BomPanel />
      </div>
      <div className={styles.status}>
        <StatusStrip />
      </div>
    </div>
  </Provider>
);
