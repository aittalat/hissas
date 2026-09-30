// إعداد ESLint المشترك لكل حزم TypeScript في المستودع.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export const ignores = {
  ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/coverage/**', '**/.turbo/**'],
};

export default tseslint.config(ignores, js.configs.recommended, ...tseslint.configs.strict, {
  languageOptions: { globals: { ...globals.node } },
  rules: {
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});
