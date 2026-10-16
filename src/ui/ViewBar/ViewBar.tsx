import { useStore } from 'jotai';

import { Button } from '../../controls/Button';
import { requestOrbit } from '../../store/view3d';

import styles from './ViewBar.module.css';

/** The 3D view's bar over the bottom of the canvas: framing buttons and a controls hint. */
export const ViewBar = () => {
  const store = useStore();
  return (
    <div className={styles.bar} role="toolbar" aria-label="3D view">
      <span className={styles.title}>3D view</span>
      <Button title="Frame the whole plan (Home)" onClick={() => requestOrbit(store, 'fit')}>
        Fit
      </Button>
      <Button
        title="Look from the default direction (0)"
        onClick={() => requestOrbit(store, 'reset')}
      >
        Reset
      </Button>
      <span className={styles.hint}>
        Left click / drag uses the tool · right drag orbits · middle, Shift+right or Space+drag pans
        · wheel zooms · 3 for 2D
      </span>
    </div>
  );
};
