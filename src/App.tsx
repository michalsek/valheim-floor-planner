import { Provider } from 'jotai';

import styles from './App.module.css';
import { FloorOutlines } from './overlay/FloorOutlines';
import { OpeningSymbols } from './overlay/OpeningSymbols';
import { Overlay } from './overlay/Overlay';
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
import { sessionStore } from './store/session';
import { ToolHost } from './tools/ToolHost';
import { ToolPreview, ToolWorldPreview } from './tools/ToolPreview';
import { BomPanel } from './ui/BomPanel/BomPanel';
import { CatalogBrowser } from './ui/CatalogBrowser/CatalogBrowser';
import { Inspector } from './ui/Inspector/Inspector';
import { PlanHeader } from './ui/PlanHeader/PlanHeader';
import { StatusStrip } from './ui/StatusStrip/StatusStrip';
import { ToolOptionsBar } from './ui/ToolOptions/ToolOptionsBar';
import { ToolRail } from './ui/ToolRail/ToolRail';

export const App = () => (
  <Provider store={sessionStore}>
    <div className={styles.app}>
      <div className={styles.rail}>
        <ToolRail />
      </div>
      <div className={styles.canvas}>
        <ToolHost>
          {/* Before the canvas, so it draws under the grid and walls. */}
          <UnderlayLayer />
          <PlanCanvas />
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
        </ToolHost>
        {/* Outside ToolHost, so clicks on them never reach the tool. The catalogue
            overlays the canvas edge, so the view doesn't jump when it opens. */}
        <CatalogBrowser />
        <ToolOptionsBar />
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
