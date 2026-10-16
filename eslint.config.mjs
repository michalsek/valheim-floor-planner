import prettierConfig from 'eslint-config-prettier';
import checkFilePlugin from 'eslint-plugin-check-file';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// camelCase or PascalCase; kebab-case and snake_case are banned (docs/Roadmap.md
// "Conventions"). `ignoreMiddleExtensions` makes Foo.test.ts and vite.config.ts
// validate only their first segment.
const NAME_PATTERN = '[a-zA-Z]*([a-zA-Z0-9])';

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '.claude/**', 'research/extract/**'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactHooksPlugin.configs.flat.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      react: reactPlugin,
      'check-file': checkFilePlugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',

      // TypeScript
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // File & directory naming (hard rule)
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx,js,jsx,mjs,cjs}': NAME_PATTERN },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { '**/': NAME_PATTERN }],
    },
  },
  // The app runs in the browser; only the root config files run in Node.
  { files: ['src/**'], languageOptions: { globals: globals.browser } },
  { files: ['*.{ts,mjs,js}'], languageOptions: { globals: globals.node } },
  prettierConfig
);
