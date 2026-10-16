import { propRect, rectSize } from '../catalog/propDefs';
import { propCentre } from '../model/geometry/propGeometry';
import type { Prop } from '../model/types';
import { useViewport } from '../store/hooks';
import { getLibrary } from '../store/libraryInstance';
import { useDisplayPlan } from '../store/planHooks';

import styles from './Overlay.module.css';
import { textWidth, type TextFont } from './textWidth';
import { useWorldToScreen } from './useWorldToScreen';

/** Labels show from this zoom (px per metre)… */
const MIN_ZOOM = 16;
/** …on footprints whose short side is at least this many px. */
const MIN_SIDE_PX = 24;
/** Shorter ellipsised labels say too little; they are left out. */
const MIN_CHARS = 4;
const PADDING_PX = 4;
// Must match `.propLabel` in Overlay.module.css.
const FONT: TextFont = { sizePx: 11, weight: 600 };

/** `text` cut to fit `maxWidth` px with an ellipsis; null when too little would be left. */
const fitText = (text: string, maxWidth: number): string | null => {
  if (textWidth(text, FONT) <= maxWidth) return text;
  for (let n = text.length - 1; n >= MIN_CHARS; n--) {
    const cut = `${text.slice(0, n).trimEnd()}…`;
    if (textWidth(cut, FONT) <= maxWidth) return cut;
  }
  return null;
};

/**
 * Room (px) for horizontal text across the footprint: its width on screen when it is
 * axis-aligned, else its short side, which a horizontal line through the centre fits
 * at any angle.
 */
const labelWidth = (size: { x: number; z: number }, rotation: number, zoom: number): number => {
  const quarterTurns = rotation / 90;
  if (!Number.isInteger(quarterTurns)) return Math.min(size.x, size.z) * zoom;
  return (quarterTurns % 2 === 0 ? size.x : size.z) * zoom;
};

const PropLabel = ({ prop, zoom }: { prop: Prop; zoom: number }) => {
  const toScreen = useWorldToScreen();
  const rect = propRect(getLibrary().propDefs, prop.prefab);
  const size = rectSize(rect);
  if (Math.min(size.x, size.z) * zoom < MIN_SIDE_PX) return null;
  const name = getLibrary().propDefs.get(prop.prefab)?.name ?? prop.prefab;
  const text = fitText(name, labelWidth(size, prop.rotation, zoom) - 2 * PADDING_PX);
  if (!text) return null;
  const { x, y } = toScreen(propCentre(prop.position, prop.rotation, rect));
  return (
    <text className={styles.propLabel} x={x} y={y} paintOrder="stroke">
      {text}
    </text>
  );
};

/** Prop names on their footprints, when zoomed in far enough (screen layer). */
export const PropLabels = () => {
  const { zoom } = useViewport();
  const props = useDisplayPlan().props;
  if (zoom < MIN_ZOOM) return null;
  return (
    <g>
      {Object.values(props).map((prop) => (
        <PropLabel key={prop.id} prop={prop} zoom={zoom} />
      ))}
    </g>
  );
};
