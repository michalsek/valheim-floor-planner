import { describe, expect, it } from 'vitest';

import {
  DEFAULT_VIEWPORT,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from './viewportMath';

const size = { width: 800, height: 600 };
const viewport: Viewport = { center: { x: 3, z: -2 }, zoom: 25 };

describe('viewportMath', () => {
  it('round-trips world → screen → world', () => {
    const p = { x: 7.25, z: -11.5 };
    const back = screenToWorld(viewport, size, worldToScreen(viewport, size, p));
    expect(back.x).toBeCloseTo(p.x);
    expect(back.z).toBeCloseTo(p.z);
  });

  it('maps the viewport centre to the middle of the screen', () => {
    expect(worldToScreen(DEFAULT_VIEWPORT, size, { x: 0, z: 0 })).toEqual({ x: 400, y: 300 });
    expect(worldToScreen(DEFAULT_VIEWPORT, size, { x: 1, z: 1 })).toEqual({ x: 440, y: 340 });
  });

  it('keeps the world point under the cursor fixed when zooming', () => {
    const s = { x: 120, y: 470 };
    const before = screenToWorld(viewport, size, s);
    const zoomed = zoomAt(viewport, size, s, 1.7);
    const after = screenToWorld(zoomed, size, s);
    expect(zoomed.zoom).toBeCloseTo(25 * 1.7);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.z).toBeCloseTo(before.z);
  });

  it('clamps zoom and does not drift at the limits', () => {
    const s = { x: 10, y: 10 };
    const max = zoomAt({ ...viewport, zoom: MAX_ZOOM }, size, s, 2);
    expect(max).toEqual({ ...viewport, zoom: MAX_ZOOM });
    expect(zoomAt(viewport, size, s, 1e-6).zoom).toBe(MIN_ZOOM);
    expect(zoomAt(viewport, size, s, 1e6).zoom).toBe(MAX_ZOOM);
  });

  it('pans so content follows the drag', () => {
    const p = { x: 1, z: 1 };
    const before = worldToScreen(viewport, size, p);
    const after = worldToScreen(panBy(viewport, 30, -20), size, p);
    expect(after.x - before.x).toBeCloseTo(30);
    expect(after.y - before.y).toBeCloseTo(-20);
  });
});
