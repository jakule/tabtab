import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
      },
      globals: {
        chrome: 'readonly',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    ignores: [
      'dist/**',
      'node_modules/**',
      'vite.config.ts',
      'jest.config.ts',
      'jest.config.js',
    ],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        'argsIgnorePattern': '^_',
        'varsIgnorePattern': '^_'
      }],
      'no-console': ['warn', { 'allow': ['warn', 'error', 'info'] }],
    },
  }
);

// export default [
// {
//   "root": true,
//   "extends": [
//     "eslint:recommended",
//     "plugin:@typescript-eslint/recommended"
//   ],
//   "parser": "@typescript-eslint/parser",
//   "parserOptions": {
//     "ecmaVersion": 2020,
//     "sourceType": "module",
//     "project": "./tsconfig.json"
//   },
//   "plugins": ["@typescript-eslint"],
//   "env": {
//     "browser": true,
//     "es2020": true,
//     "webextensions": true
//   },
//   "rules": {
//     "@typescript-eslint/explicit-function-return-type": "warn",
//     "@typescript-eslint/no-explicit-any": "warn",
//     "@typescript-eslint/no-unused-vars": ["error", {
//       "argsIgnorePattern": "^_",
//       "varsIgnorePattern": "^_"
//     }],
//     "no-console": ["warn", { "allow": ["warn", "error", "info"] }]
//   },
//   "ignorePatterns": [
//     "dist",
//     "node_modules",
//     "vite.config.ts",
//     "jest.config.ts"
//   ]
// }
// ];