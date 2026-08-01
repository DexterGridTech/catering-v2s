import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

const generatedSource = 'apps/frontend/*/src/app/api/generated/**';
const testSource = 'apps/frontend/*/src/tests/**';

export default [
  {
    ignores: [
      '**/build/**',
      '**/dist/**',
      '**/node_modules/**',
      generatedSource,
      testSource,
    ],
  },
  {
    files: [
      'apps/frontend/*/src/**/*.{ts,tsx}',
      'libraries/frontend/admin-ui-foundation/src/**/*.{ts,tsx}',
    ],
    ignores: [generatedSource, testSource],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {projectService: true},
    },
    plugins: {'@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks},
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
      '@typescript-eslint/no-floating-promises': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['apps/frontend/*/src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='Identifier'][callee.name='fetch']",
          message: 'Feature code must consume the app-owned generated typed transport.',
        },
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.object.name='window'][callee.property.name='fetch']",
          message: 'Feature code must consume the app-owned generated typed transport.',
        },
        {
          selector: "NewExpression[callee.type='Identifier'][callee.name='XMLHttpRequest']",
          message: 'Feature code must consume the app-owned generated typed transport.',
        },
      ],
    },
  },
];
