import react from '@vitejs/plugin-react';
import typegpu from 'unplugin-typegpu/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The TypeGPU plugin transpiles 'use gpu' functions (the grid shader) to WGSL/GLSL.
  plugins: [typegpu({}), react()],
  // three.js (WebGPU + TSL) and TypeGPU make one ~2 MB chunk; that's fine for this app.
  build: { chunkSizeWarningLimit: 2500 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
