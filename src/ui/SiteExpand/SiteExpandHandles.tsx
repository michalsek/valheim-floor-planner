import { useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';

import { openWorldPanel } from '../../install/loadWorld';
import { terrainAvailability, type TerrainAvailability } from '../../install/siteGeneration';
import {
  EXTEND_STEP,
  growRect,
  roomToGrow,
  SITE_SIDES,
  type SiteSide,
} from '../../model/terrain/siteExtend';
import { MAX_SITE_SIDE } from '../../model/terrain/sitePatch';
import type { ImportFrame, SiteTerrain, Vec2 } from '../../model/types';
import { useViewMode, useViewport, useViewportSize } from '../../store/hooks';
import { projection3dAtom } from '../../store/session';
import { revealSitesAtom } from '../../store/siteWorld';
import { useShownSiteTerrain, type SiteGround } from '../../store/siteTerrain';
import { extendTerrain } from '../../store/worldImport';
import { useToolContext } from '../../tools/toolContext';
import { project3d } from '../../viewport/projection3d';
import { revealNotice } from '../WorldPanel/worldCopy';
import { worldToScreen, type ScreenPoint } from '../../viewport/viewportMath';

import styles from './SiteExpand.module.css';
import { siteHandle, stripOutline, visibleSpan, type SiteHandle } from './siteHandles';
import { useSiteWorld, type SiteWorldStatus } from './useSiteWorld';

/** Shift-click grows this many steps at once. */
const SHIFT_STEPS = 4;
/** The 3D wall's height over the ground (metres), and at least this on screen (px). */
const WALL_HEIGHT = 6;
const MIN_WALL_PX = 22;
/** The 2D tab's depth beyond the patch edge (px), and the room it keeps from the view's edge. */
const TAB_DEPTH = 22;
const VIEW_MARGIN = 12;
/** A 3D wall bigger than this share of the view is left out (the camera is at it). */
const MAX_SCREEN_SHARE = 0.5;
/** How long a refusal stays on its handle (ms). */
const MESSAGE_MS = 6000;

/** A plan point at a plan height to the canvas (CSS px); null behind the camera. */
type Project = (p: Vec2, y: number) => ScreenPoint | null;

const useProject = (): Project | null => {
  const is2d = useViewMode() === '2d';
  const viewport = useViewport();
  const size = useViewportSize();
  const projection = useAtomValue(projection3dAtom);
  return useMemo(() => {
    if (is2d) return (p) => worldToScreen(viewport, size, p);
    return projection ? (p, y) => project3d({ x: p.x, y, z: p.z }, projection) : null;
  }, [is2d, viewport, size, projection]);
};

const points = (ps: readonly ScreenPoint[]) => ps.map((p) => `${p.x},${p.y}`).join(' ');

const centre = (ps: readonly ScreenPoint[]): ScreenPoint => ({
  x: ps.reduce((s, p) => s + p.x, 0) / ps.length,
  y: ps.reduce((s, p) => s + p.y, 0) / ps.length,
});

/** The handle on screen: the 3D wall standing on the edge, or the 2D tab outside it. */
const handleShape = (
  handle: SiteHandle,
  project: Project,
  is2d: boolean,
  view: { width: number; height: number }
): ScreenPoint[] | null => {
  const [a, b] = handle.ends;
  if (is2d) {
    // Along the part of the edge in view, so a site bigger than the view keeps its handles.
    const ea = project(handle.edge[0], 0)!;
    const eb = project(handle.edge[1], 0)!;
    const pa = project(a, 0)!;
    const pb = project(b, 0)!;
    const length = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const span = visibleSpan(ea, eb, length, view, TAB_DEPTH + VIEW_MARGIN);
    if (!span) return null;
    const along = (t: number) => ({ x: ea.x + (eb.x - ea.x) * t, y: ea.y + (eb.y - ea.y) * t });
    const [p, q] = [along(span.from), along(span.to)];
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const from = project(mid, 0)!;
    const to = project({ x: mid.x + handle.outward.x, z: mid.z + handle.outward.z }, 0)!;
    const unit = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const n = {
      x: ((to.x - from.x) / unit) * TAB_DEPTH,
      y: ((to.y - from.y) / unit) * TAB_DEPTH,
    };
    return [p, q, { x: q.x + n.x, y: q.y + n.y }, { x: p.x + n.x, y: p.y + n.y }];
  }
  const top = handle.base + WALL_HEIGHT;
  const corners = [
    project(a, handle.base),
    project(b, handle.base),
    project(b, top),
    project(a, top),
  ];
  if (corners.some((c) => c === null)) return null;
  const [p, q, qTop, pTop] = corners as ScreenPoint[];
  // Far away the wall keeps a clickable height: its top raised on screen.
  const raise = (base: ScreenPoint, up: ScreenPoint) => {
    const height = Math.hypot(up.x - base.x, up.y - base.y);
    if (height >= MIN_WALL_PX) return up;
    const k = MIN_WALL_PX / (height || 1);
    return { x: base.x + (up.x - base.x) * k, y: base.y + (up.y - base.y) * k };
  };
  const shape = [p!, q!, raise(q!, qTop!), raise(p!, pTop!)];
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const tooBig =
    Math.max(...xs) - Math.min(...xs) > view.width * MAX_SCREEN_SHARE ||
    Math.max(...ys) - Math.min(...ys) > view.height * MAX_SCREEN_SHARE;
  return tooBig ? null : shape;
};

/** What a handle can do now, and what it says. */
interface HandleState {
  label: string;
  title: string;
  /** Clicking does nothing (at the cap, unsupported ground, another side growing). */
  disabled: boolean;
}

const sideLength = (terrain: SiteTerrain, side: SiteSide) =>
  (side === 'west' || side === 'east' ? terrain.cols : terrain.rows) - 1;

const stateOf = (
  terrain: SiteTerrain,
  frame: ImportFrame,
  side: SiteSide,
  ctx: {
    running: SiteSide | null;
    world: SiteWorldStatus;
    availability: TerrainAvailability | null;
    message: string | null;
    reveal: boolean;
  }
): HandleState => {
  const step = Math.min(EXTEND_STEP, roomToGrow(terrain, side));
  const length = `The site is ${sideLength(terrain, side)} m across this way, at most ${MAX_SITE_SIDE} m.`;
  if (ctx.running === side)
    return { label: 'Extending…', title: 'Making the new ground…', disabled: true };
  if (step === 0) {
    return {
      label: `max ${MAX_SITE_SIDE} m`,
      title: `The site is at its largest this way: ${MAX_SITE_SIDE} m a side.`,
      disabled: true,
    };
  }
  const label = ctx.message ?? `+${step} m`;
  if (ctx.world === 'missing') {
    return {
      label,
      title:
        `To extend the terrain, open ${frame.worldName} in the World panel (click to open it): ` +
        'the plan keeps the ground, not the world it came from.',
      disabled: false,
    };
  }
  if (ctx.availability && !ctx.availability.ok) {
    return { label: ctx.message ?? 'no ground', title: ctx.availability.reason, disabled: true };
  }
  const more = Math.min(EXTEND_STEP * SHIFT_STEPS, roomToGrow(terrain, side));
  const sites = ctx.reveal
    ? 'Sites it reveals come in too.'
    : 'Sites it reveals stay out (Load revealed sites is off in the World panel).';
  const title = `Extend the terrain ${step} m ${side} (Shift: ${more} m). ${length}\n${sites}`;
  return {
    label,
    title: ctx.message ? `${ctx.message}\n\n${title}` : title,
    disabled: ctx.running !== null,
  };
};

const Handle = ({
  handle,
  project,
  is2d,
  state,
  step,
  onExtend,
  onHover,
}: {
  handle: SiteHandle;
  project: Project;
  is2d: boolean;
  state: HandleState;
  step: number;
  onExtend: (side: SiteSide, shift: boolean) => void;
  onHover: () => void;
}) => {
  const [hover, setHover] = useState(false);
  const projection = useAtomValue(projection3dAtom);
  const size = useViewportSize();
  const view = is2d ? size : (projection?.size ?? size);
  const shape = handleShape(handle, project, is2d, view);
  if (!shape) return null;
  const strip = hover && !state.disabled ? stripOutline(handle, step) : null;
  const stripShape = strip?.map((p) => project(p, handle.base));
  const at = centre(shape);
  const click = (e: MouseEvent<SVGGElement>) => {
    if (!state.disabled) onExtend(handle.side, e.shiftKey);
  };
  return (
    <>
      {stripShape?.every((p) => p !== null) && (
        <polygon className={styles.strip} points={points(stripShape)} />
      )}
      <g
        className={state.disabled ? `${styles.handle} ${styles.disabled}` : styles.handle}
        role="button"
        aria-label={`Extend the terrain ${handle.side}`}
        aria-disabled={state.disabled}
        onClick={click}
        onPointerEnter={() => {
          setHover(true);
          onHover();
        }}
        onPointerLeave={() => setHover(false)}
      >
        <title>{state.title}</title>
        <polygon points={points(shape)} />
        <text className={styles.label} x={at.x} y={at.y} paintOrder="stroke">
          {state.label}
        </text>
      </g>
    </>
  );
};

/** Which sides' new strips the world can make ground for (null until the world is found). */
const useAvailability = (
  ground: SiteGround,
  world: Parameters<typeof terrainAvailability>[0] | null
) =>
  useMemo(() => {
    const out = new Map<SiteSide, TerrainAvailability>();
    if (!world) return out;
    for (const side of SITE_SIDES) {
      const growth = growRect(ground.terrain, side, EXTEND_STEP);
      if (growth) out.set(side, terrainAvailability(world, growth.strip));
    }
    return out;
  }, [ground.terrain, world]);

const Handles = ({ ground, project }: { ground: SiteGround; project: Project }) => {
  const ctx = useToolContext();
  const is2d = useViewMode() === '2d';
  const reveal = useAtomValue(revealSitesAtom);
  const site = useSiteWorld(ground.frame);
  const availability = useAvailability(ground, site.world);
  const [running, setRunning] = useState<SiteSide | null>(null);
  const [message, setMessage] = useState<{ side: SiteSide; text: string } | null>(null);
  const handles = useMemo(() => SITE_SIDES.map((side) => siteHandle(ground, side)), [ground]);
  const cancel = useRef<AbortController | null>(null);
  useEffect(() => () => cancel.current?.abort(), []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const extend = async (side: SiteSide, shift: boolean) => {
    if (running) return;
    setMessage(null);
    const world = site.world ?? (await site.resolve());
    if (!world) return openWorldPanel();
    const controller = new AbortController();
    cancel.current = controller;
    setRunning(side);
    const metres = EXTEND_STEP * (shift ? SHIFT_STEPS : 1);
    const result = await extendTerrain(ctx, world, side, metres, {
      onPhase: () => {},
      signal: controller.signal,
      reveal,
    });
    setRunning(null);
    if (result === 'cancelled') return;
    const text = 'error' in result ? result.error : revealNotice(result);
    if (text) setMessage({ side, text });
  };
  const hovered = () => {
    if (site.status === 'unknown') void site.resolve();
  };

  return (
    <>
      {handles.map((handle) => {
        const state = stateOf(ground.terrain, ground.frame, handle.side, {
          running,
          world: site.status,
          availability: availability.get(handle.side) ?? null,
          message: message?.side === handle.side ? message.text : null,
          reveal,
        });
        return (
          <Handle
            key={handle.side}
            handle={handle}
            project={project}
            is2d={is2d}
            state={state}
            step={Math.min(EXTEND_STEP, roomToGrow(ground.terrain, handle.side))}
            onExtend={(side, shift) => void extend(side, shift)}
            onHover={hovered}
          />
        );
      })}
    </>
  );
};

/**
 * The site's expand handles, over the canvas in both views (outside `ToolHost`, so a
 * click never reaches the tool or the orbit controls): a wall standing on the middle of
 * each terrain patch edge in 3D, a tab outside the dashed patch outline in 2D. A click
 * grows the site that way by a zone (64 m; Shift: 256 m) up to `MAX_SITE_SIDE`, as one
 * undoable step; hovering shows the strip it adds. The new ground comes from the world
 * the import came from, which must be open in, or kept by, the World panel (the plan
 * doesn't keep the seed); without it a click opens the panel.
 */
export const SiteExpandHandles = () => {
  const ground = useShownSiteTerrain();
  const project = useProject();
  if (!ground || !project) return null;
  return (
    <svg className={styles.layer}>
      <Handles ground={ground} project={project} />
    </svg>
  );
};
