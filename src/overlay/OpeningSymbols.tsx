import { useAtomValue } from 'jotai';

import type { OpeningKind } from '../catalog/openingDefs';
import { sideNormal } from '../model/geometry/polyline';
import type { Hit } from '../model/hitTest';
import type { ResolvedOpening } from '../model/openings';
import { isSelected, type Selection } from '../model/selection';
import type { Vec2 } from '../model/types';
import { useDisplayDerived } from '../store/planHooks';
import { hoverAtom, selectionAtom } from '../store/selection';

import styles from './Overlay.module.css';
import { toSvgPoints } from './svgPoints';

const ARC_STEPS = 8;
/** Size (m) of the mark for an opening that is on no segment. */
const LOOSE_MARK = 0.4;

const along = (p: Vec2, v: Vec2, k: number): Vec2 => ({ x: p.x + v.x * k, z: p.z + v.z * k });

/** A quarter circle about `hinge` from direction `from` to direction `to`. */
const quarterArc = (hinge: Vec2, from: Vec2, to: Vec2, r: number): Vec2[] =>
  Array.from({ length: ARC_STEPS + 1 }, (_, k) => {
    const t = (k / ARC_STEPS) * (Math.PI / 2);
    return {
      x: hinge.x + (from.x * Math.cos(t) + to.x * Math.sin(t)) * r,
      z: hinge.z + (from.z * Math.cos(t) + to.z * Math.sin(t)) * r,
    };
  });

/** A leaf swung open to `swing` and the arc it closes along. */
const leaf = (hinge: Vec2, swing: Vec2, closeDir: Vec2, r: number): Vec2[][] => [
  [hinge, along(hinge, swing, r)],
  quarterArc(hinge, swing, closeDir, r),
];

/**
 * Plan symbol lines for an opening from `start` to `end` along `dir`: a door's leaf
 * and quarter arc, a gate's two half leaves, or a grate's bar. Leaves swing to the
 * right of the segment (inside, on a loop).
 */
const symbolLines = (kind: OpeningKind, start: Vec2, end: Vec2, dir: Vec2): Vec2[][] => {
  const width = Math.hypot(end.x - start.x, end.z - start.z);
  const swing = sideNormal(dir, 'right');
  const back = { x: -dir.x, z: -dir.z };
  switch (kind) {
    case 'door':
      return leaf(start, swing, dir, width);
    case 'gate':
      return [...leaf(start, swing, dir, width / 2), ...leaf(end, swing, back, width / 2)];
    case 'grate':
      return [[start, end]];
  }
};

interface OpeningSymbolProps {
  kind: OpeningKind;
  /** Centre of the gap (on the strip centre for block walls). */
  center: Vec2;
  dir: Vec2;
  width: number;
  className: string | undefined;
}

/** One opening's plan symbol (world layer). */
export const OpeningSymbol = ({ kind, center, dir, width, className }: OpeningSymbolProps) => {
  const start = along(center, dir, -width / 2);
  const end = along(center, dir, width / 2);
  const dashed = kind === 'grate' ? ` ${styles.openingDashed}` : '';
  return (
    <g className={`${className ?? ''}${dashed}`}>
      <polyline
        points={toSvgPoints([start, end])}
        className={styles.openingSill}
        vectorEffect="non-scaling-stroke"
      />
      {symbolLines(kind, start, end, dir).map((points, i) => (
        <polyline key={i} points={toSvgPoints(points)} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
};

/** A cross for an opening that resolves onto no segment. */
const LooseMark = ({ at, className }: { at: Vec2; className: string | undefined }) => {
  const d = LOOSE_MARK;
  const lines = [
    [
      { x: at.x - d, z: at.z - d },
      { x: at.x + d, z: at.z + d },
    ],
    [
      { x: at.x - d, z: at.z + d },
      { x: at.x + d, z: at.z - d },
    ],
  ];
  return (
    <g className={className}>
      {lines.map((points, i) => (
        <polyline key={i} points={toSvgPoints(points)} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
};

/** The selected, hovered, problem or plain tone of an opening's symbol. */
const toneFor = (o: ResolvedOpening, selection: Selection, hover: Hit | null) => {
  if (isSelected(selection, { kind: 'opening', id: o.id })) return styles.openingSelected;
  if (hover?.kind === 'opening' && hover.id === o.id) return styles.openingHover;
  return o.problem ? styles.openingProblem : styles.openingSymbol;
};

/**
 * Every opening's symbol (world layer): the selection colour when selected or hovered,
 * the danger colour when it has a problem (and isn't cut).
 */
export const OpeningSymbols = () => {
  const { openings } = useDisplayDerived();
  const selection = useAtomValue(selectionAtom);
  const hover = useAtomValue(hoverAtom);

  return (
    <g>
      {openings.map((o) => {
        const tone = toneFor(o, selection, hover);
        if (!o.def || o.segment === null) {
          return <LooseMark key={o.id} at={o.center} className={tone} />;
        }
        return (
          <OpeningSymbol
            key={o.id}
            kind={o.def.kind}
            center={o.stripCenter}
            dir={o.dir}
            width={o.def.width}
            className={tone}
          />
        );
      })}
    </g>
  );
};
