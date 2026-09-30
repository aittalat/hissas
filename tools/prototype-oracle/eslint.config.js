import base from '@hissas/config/eslint';
import globals from 'globals';

export default [
  ...base,
  {
    files: ['src/*.js'],
    languageOptions: { globals: { ...globals.browser } },
    // الجسر يعدّل كائنات النموذج الأولي القابلة للتغيير (SUB)
    rules: { '@typescript-eslint/no-dynamic-delete': 'off' },
  },
];
