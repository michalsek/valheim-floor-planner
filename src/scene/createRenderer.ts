import { WebGPURenderer, type WebGPURendererParameters } from 'three/webgpu';

import type { RendererBackend } from '../store/session';

/**
 * Builds r3f's async `gl` factory: a `WebGPURenderer` that falls back to WebGL2 by
 * itself when WebGPU is unavailable (`?webgl` in the URL forces WebGL2). Reports the
 * backend it ended up with once initialised.
 *
 * r3f passes its default renderer props (the canvas, alpha, power preference…) typed
 * for `WebGLRenderer`; they're compatible, hence the cast. The canvas stays
 * transparent, so the page's `--canvas-bg` shows through.
 */
export const createRenderer =
  (onBackend: (backend: Exclude<RendererBackend, 'pending'>) => void) =>
  async (defaults: object): Promise<WebGPURenderer> => {
    const renderer = new WebGPURenderer({
      ...(defaults as WebGPURendererParameters),
      antialias: true,
      forceWebGL: new URLSearchParams(window.location.search).has('webgl'),
    });
    await renderer.init();
    onBackend('isWebGPUBackend' in renderer.backend ? 'WebGPU' : 'WebGL2');
    return renderer;
  };
