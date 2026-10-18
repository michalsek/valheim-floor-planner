import react from '@vitejs/plugin-react';
import typegpu from 'unplugin-typegpu/vite';
import { configDefaults, defineConfig } from 'vitest/config';

import { GAME_DATA_DIR, gameDataTests, hasGameData } from './src/catalog/testGameData.ts';

// A public clone has no game-data fixtures (they live in the private satellite repo):
// the tests that need them are left out with one note instead of failing.
const skippedTests = process.env.VITEST && !hasGameData() ? gameDataTests() : [];
if (skippedTests.length > 0) {
  console.warn(
    `game-data fixtures not found in ${GAME_DATA_DIR}: ${skippedTests.length} test files skipped`
  );
}

export default defineConfig({
  // The TypeGPU plugin transpiles 'use gpu' functions (the grid shader) to WGSL/GLSL.
  plugins: [typegpu({}), react()],
  // three.js (WebGPU + TSL) and TypeGPU make one ~2 MB chunk; that's fine for this app.
  build: { chunkSizeWarningLimit: 2500 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, ...skippedTests],
  },
});
