import { Provider } from 'jotai';

import styles from './App.module.css';
import { FloorOutlines } from './overlay/FloorOutlines';
import { OpeningSymbols } from './overlay/OpeningSymbols';
import { Overlay } from './overlay/Overlay';
import { PinnedDimensions } from './overlay/PinnedDimensions';
import { RoomLabels } from './overlay/RoomLabels';
import { RoomOutlines } from './overlay/RoomOutlines';
import { SelectionHighlight } from './overlay/SelectionHighlight';
import { SnapCursor } from './overlay/SnapCursor';
import { WallLines } from './overlay/WallLines';
import { PlanCanvas } from './scene/PlanCanvas';
import { sessionStore } from './store/session';
import { ToolHost } from './tools/ToolHost';
import { ToolPreview, ToolWorldPreview } from './tools/ToolPreview';
import { BomPanel } from './ui/BomPanel/BomPanel';
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
          <PlanCanvas />
          <Overlay
            world={
              <>
                <FloorOutlines />
                <RoomOutlines />
                <WallLines />
                <OpeningSymbols />
                <SelectionHighlight />
                <ToolWorldPreview />
              </>
            }
          >
            <RoomLabels />
            <PinnedDimensions />
            <ToolPreview />
            <SnapCursor />
          </Overlay>
        </ToolHost>
        {/* Outside ToolHost, so clicks on it never reach the tool. */}
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
