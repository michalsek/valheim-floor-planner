import { useStore } from 'jotai';

import { SegmentedControl } from '../../controls/SegmentedControl';
import { useViewMode } from '../../store/hooks';
import { setViewMode, type ViewMode } from '../../store/view3d';

import styles from './StatusStrip.module.css';

const OPTIONS: readonly { value: ViewMode; label: string }[] = [
  { value: '2d', label: '2D' },
  { value: '3d', label: '3D' },
];

/** 2D plan or 3D view of the same plan (3 toggles it). */
export const ViewToggle = () => {
  const store = useStore();
  return (
    <div className={styles.picker} title="Plan or 3D view (3)">
      <SegmentedControl<ViewMode>
        label="View"
        options={OPTIONS}
        value={useViewMode()}
        onChange={(mode) => setViewMode(store, mode)}
      />
    </div>
  );
};
