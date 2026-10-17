import { useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from 'react';

import type { WorldCluster } from '../../model/world/clusters';
import type { PieceCloud } from '../../model/world/pieceCloud';

import styles from './WorldPanel.module.css';

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The map's aspect (width / height), as its CSS box. */
const ASPECT = 4 / 3;
/** The smallest span shown (metres): a lone build isn't blown up. */
const MIN_SPAN = 100;

/** The view around every cluster, north (+z) up: SVG y is −z. */
const fit = (clusters: readonly WorldCluster[]): View => {
  if (clusters.length === 0)
    return { x: -MIN_SPAN / 2, y: -MIN_SPAN / 2, w: MIN_SPAN * ASPECT, h: MIN_SPAN };
  const minX = Math.min(...clusters.map((c) => c.min.x));
  const maxX = Math.max(...clusters.map((c) => c.max.x));
  const minY = Math.min(...clusters.map((c) => -c.max.z));
  const maxY = Math.max(...clusters.map((c) => -c.min.z));
  const h = Math.max((maxX - minX) / ASPECT, maxY - minY, MIN_SPAN) * 1.25;
  const w = h * ASPECT;
  return { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h };
};

/** Pieces drawn as dots at most (a sample beyond it): one path, for big worlds too. */
const MAX_DOTS = 60_000;

/** Every shown piece as a zero-length segment: a round-capped dot of constant size. */
const dotsPath = (cloud: Pick<PieceCloud, 'position'>, clusters: readonly WorldCluster[]) => {
  const indices = clusters.flatMap((c) => c.indices);
  const stride = Math.max(1, Math.ceil(indices.length / MAX_DOTS));
  const parts: string[] = [];
  for (let k = 0; k < indices.length; k += stride) {
    const i = indices[k]!;
    const x = cloud.position[i * 3]!;
    const z = cloud.position[i * 3 + 2]!;
    parts.push(`M${x.toFixed(2)} ${(-z).toFixed(2)}h0`);
  }
  return parts.join('');
};

interface ClusterMapProps {
  cloud: Pick<PieceCloud, 'position'>;
  clusters: readonly WorldCluster[];
  selected: WorldCluster | undefined;
  onSelect(cluster: WorldCluster): void;
}

/**
 * The builds on a map of the world as the game's map shows it (north up): their pieces
 * as dots, each build's bounds, a marker sized by its piece count and the count. Wheel
 * zooms, drag pans.
 */
export const ClusterMap = ({ cloud, clusters, selected, onSelect }: ClusterMapProps) => {
  const fitted = useMemo(() => fit(clusters), [clusters]);
  const dots = useMemo(() => dotsPath(cloud, clusters), [cloud, clusters]);
  const [view, setView] = useState<View | null>(null);
  const [fittedFor, setFittedFor] = useState(fitted);
  if (fittedFor !== fitted) {
    setFittedFor(fitted);
    setView(null);
  }
  const v = view ?? fitted;
  const svg = useRef<SVGSVGElement>(null);
  // The wheel zooms the map, not the panel: React's wheel listener is passive.
  useEffect(() => {
    const el = svg.current;
    const stop = (e: Event) => e.preventDefault();
    el?.addEventListener('wheel', stop, { passive: false });
    return () => el?.removeEventListener('wheel', stop);
  }, []);
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);

  /** Metres per CSS pixel. */
  const scale = () => v.w / (svg.current?.clientWidth || 1);
  const unit = v.w / 120; // labels and dots, in metres: constant on screen
  const largest = Math.max(1, ...clusters.map((c) => c.indices.length));

  const onWheel = (e: WheelEvent) => {
    const rect = svg.current!.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const k = Math.exp(e.deltaY * 0.0015);
    const w = Math.min(Math.max(v.w * k, 10), 30_000);
    const h = w / ASPECT;
    setView({ x: v.x + fx * (v.w - w), y: v.y + fy * (v.h - h), w, h });
  };
  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.target !== e.currentTarget) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, view: v };
  };
  const onPointerMove = (e: PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const s = scale();
    setView({
      ...start.view,
      x: start.view.x - (e.clientX - start.x) * s,
      y: start.view.y - (e.clientY - start.y) * s,
    });
  };
  const endDrag = () => (drag.current = null);

  return (
    <svg
      ref={svg}
      className={styles.map}
      viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label="Builds in the world, north up"
    >
      {/* The world's centre (spawn is near it). */}
      <path
        className={styles.mapAxis}
        d={`M ${-unit * 2} 0 H ${unit * 2} M 0 ${-unit * 2} V ${unit * 2}`}
      />
      <path className={styles.mapDots} d={dots} vectorEffect="non-scaling-stroke" />
      {clusters.map((c) => {
        const on = c === selected;
        const r = unit * (0.6 + 1.4 * Math.sqrt(c.indices.length / largest));
        return (
          <g
            key={c.indices[0]}
            className={on ? `${styles.mapCluster} ${styles.mapClusterOn}` : styles.mapCluster}
            onClick={() => onSelect(c)}
          >
            <rect
              x={c.min.x}
              y={-c.max.z}
              width={Math.max(c.max.x - c.min.x, 0.01)}
              height={Math.max(c.max.z - c.min.z, 0.01)}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={c.min.x} cy={-c.max.z} r={r} />
            <text x={c.max.x + unit} y={-c.max.z + unit * 1.6} fontSize={unit * 1.8}>
              {c.indices.length.toLocaleString('en-GB')}
            </text>
          </g>
        );
      })}
      <text
        className={styles.mapNorth}
        x={v.x + v.w - unit * 4}
        y={v.y + unit * 3}
        fontSize={unit * 1.8}
      >
        N ↑
      </text>
    </svg>
  );
};
