import { Provider } from 'jotai';

import styles from './App.module.css';
import { Overlay } from './overlay/Overlay';
import { SnapCursor } from './overlay/SnapCursor';
import { PlanCanvas } from './scene/PlanCanvas';
import { sessionStore } from './store/session';
import { ToolHost } from './tools/ToolHost';
import { ToolPreview, ToolWorldPreview } from './tools/ToolPreview';
import { StatusStrip } from './ui/StatusStrip/StatusStrip';
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
          <Overlay world={<ToolWorldPreview />}>
            <ToolPreview />
            <SnapCursor />
          </Overlay>
        </ToolHost>
      </div>
      <div className={styles.status}>
        <StatusStrip />
      </div>
    </div>
  </Provider>
);
