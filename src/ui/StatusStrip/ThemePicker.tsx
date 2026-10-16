import { useAtom } from 'jotai';

import { SegmentedControl } from '../../controls/SegmentedControl';
import { themePrefAtom, type ThemePref } from '../../store/theme';

import styles from './StatusStrip.module.css';

const OPTIONS: readonly { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** System / Light / Dark; the choice is remembered in this browser. */
export const ThemePicker = () => {
  const [pref, setPref] = useAtom(themePrefAtom);
  return (
    <div className={styles.picker} title="Colour theme">
      <span>Theme</span>
      <SegmentedControl<ThemePref>
        label="Theme"
        options={OPTIONS}
        value={pref}
        onChange={setPref}
      />
    </div>
  );
};
