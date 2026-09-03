import { defineConfig, globalIgnores } from 'eslint/config';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  /*
   * Base JavaScript
   */
  eslint.configs.recommended,

  /*
   * TypeScript
   */
  ...tseslint.configs.recommended,

  /*
   * TrackRoster naming conventions
   */
  {
    files: ['**/*.{ts,tsx}'],

    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',

      '@typescript-eslint/naming-convention': [
        'error',

        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },

        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },

        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },

        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
      ],
    },
  },

  /*
   * Next.js rules
   *
   * Only apply to apps/web.
   */
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],

    plugins: {
      '@next/next': nextPlugin,
    },

    settings: {
      next: {
        rootDir: 'apps/web/',
      },
    },

    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },

  /*
   * Prettier compatibility
   */
  prettier,

  /*
   * Ignore generated files
   */
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/generated/**',
    '**/next-env.d.ts',
  ]),
]);
