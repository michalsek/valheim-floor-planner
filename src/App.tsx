import { Provider } from 'jotai';

import styles from './App.module.css';
import { Overlay } from './overlay/Overlay';
import { SnapCursor } from './overlay/SnapCursor';
import { WallLines } from './overlay/WallLines';
import { PlanCanvas } from './scene/PlanCanvas';
import { sessionStore } from './store/session';
import { ToolHost } from './tools/ToolHost';
import { ToolPreview, ToolWorldPreview } from './tools/ToolPreview';
import { BomPanel } from './ui/BomPanel/BomPanel';
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
                <WallLines />
                <ToolWorldPreview />
              </>
            }
          >
            <ToolPreview />
            <SnapCursor />
          </Overlay>
        </ToolHost>
        {/* Outside ToolHost, so clicks on it never reach the tool. */}
        <ToolOptionsBar />
      </div>
      <div className={styles.bom}>
        <BomPanel />
      </div>
      <div className={styles.status}>
        <StatusStrip />
      </div>
    </div>
  </Provider>
);
