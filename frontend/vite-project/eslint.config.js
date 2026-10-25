import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Archived dashboard copies kept for reference. They are not imported
    // by the app (verified with an import scan) and don't parse under the
    // current JSX parser, so they are excluded instead of deleted.
    'src/pages/platform/meetdashboard-old.jsx',
    'src/pages/platform/old_meetdashboard.jsx',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    /* Legacy copy of the Express/Mongoose backend that lives inside the
       Vite tree. The shipped backend is /backend at the repository root;
       this folder is CommonJS and is never bundled, so lint it with Node
       globals instead of rewriting it as an ES module. */
    files: ['src/backend/**/*.js'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'commonjs',
      },
    },
  },
])
