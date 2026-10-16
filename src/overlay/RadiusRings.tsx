import { useAtomValue } from 'jotai';

import { library } from '../catalog';
import { propRadius, type PropRadius } from '../catalog/stations';
import { formatCompact } from '../format';
import { isSelected } from '../model/selection';
import type { Prop } from '../model/types';
import { useViewport } from '../store/hooks';
import { useDisplayPlan } from '../store/planHooks';
import { selectionAtom } from '../store/selection';
import { showAllRadiiAtom } from '../store/session';
import type { ScreenPoint } from '../viewport/viewportMath';

import styles from './Overlay.module.css';
import { textWidth, type TextFont } from './textWidth';
import { useWorldToScreen } from './useWorldToScreen';

/** Rings smaller than this (screen px) go unlabelled. */
const LABEL_MIN_RADIUS_PX = 40;
/** Gap (px) between the top of the ring and its label. */
const LABEL_INSET = 12;
// Must match `.labelSecondary` in Overlay.module.css.
const LABEL_FONT: TextFont = { sizePx: 11, weight: 400 };
const LABEL_HEIGHT = 14;

type RingProp = Pick<Prop, 'prefab' | 'position' | 'upgrades'>;

interface Ring {
  key: string;
  kind: PropRadius['kind'];
  centre: ScreenPoint;
  r: number;
  label: { text: string; x: number; y: number; width: number } | null;
}

const ringOf = (
  key: string,
  prop: RingProp,
  zoom: number,
  toScreen: (p: Prop['position']) => ScreenPoint
): Ring | null => {
  const radius = propRadius(prop.prefab, prop.upgrades, library.catalog);
  if (!radius) return null;
  const centre = toScreen(prop.position);
  const r = radius.radius * zoom;
  const name = library.propDefs.get(prop.prefab)?.name ?? prop.prefab;
  const text = `${name} ${formatCompact(radius.radius)} m`;
  const label =
    r >= LABEL_MIN_RADIUS_PX
      ? { text, x: centre.x, y: centre.y - r + LABEL_INSET, width: textWidth(text, LABEL_FONT) }
      : null;
  return { key, kind: radius.kind, centre, r, label };
};

type Label = NonNullable<Ring['label']>;

const overlaps = (a: Label, b: Label): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < LABEL_HEIGHT;

/** Drops each label that would overlap one kept before it (rings in priority order). */
const withoutOverlaps = (rings: readonly Ring[]): Ring[] => {
  const kept: Label[] = [];
  return rings.map((ring) => {
    const { label } = ring;
    if (!label || kept.some((other) => overlaps(label, other))) return { ...ring, label: null };
    kept.push(label);
    return ring;
  });
};

/**
 * A station's build radius or the ward's, as a dashed circle about the prop's pivot,
 * with its "Workbench 28 m" label (screen layer, so the dashes keep their size).
 */
const RingShape = ({ ring }: { ring: Ring }) => (
  <g>
    <circle
      className={ring.kind === 'ward' ? styles.ringWard : styles.ringBuild}
      cx={ring.centre.x}
      cy={ring.centre.y}
      r={ring.r}
    />
    {ring.label && (
      <text className={styles.labelSecondary} x={ring.label.x} y={ring.label.y} paintOrder="stroke">
        {ring.label.text}
      </text>
    )}
  </g>
);

/** One prop's ring (the Prop tool's ghost). */
export const RadiusRing = ({ prop }: { prop: RingProp }) => {
  const toScreen = useWorldToScreen();
  const { zoom } = useViewport();
  const ring = ringOf('ghost', prop, zoom, toScreen);
  return ring ? <RingShape ring={ring} /> : null;
};

/**
 * Rings of the selected props, or of every prop while "Radii" is on. Selected rings
 * get their labels first; a label that would overlap one already shown is hidden.
 */
export const RadiusRings = () => {
  const props = useDisplayPlan().props;
  const selection = useAtomValue(selectionAtom);
  const showAll = useAtomValue(showAllRadiiAtom);
  const toScreen = useWorldToScreen();
  const { zoom } = useViewport();
  const selected = (prop: Prop) => isSelected(selection, { kind: 'prop', id: prop.id });
  const shown = Object.values(props)
    .filter((prop) => showAll || selected(prop))
    .sort((a, b) => Number(selected(b)) - Number(selected(a)))
    .flatMap((prop) => ringOf(prop.id, prop, zoom, toScreen) ?? []);
  return (
    <g>
      {withoutOverlaps(shown).map((ring) => (
        <RingShape key={ring.key} ring={ring} />
      ))}
    </g>
  );
};
