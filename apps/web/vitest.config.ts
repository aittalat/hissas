import { defineConfig } from 'vitest/config';

// e2e/ تشغّله Playwright (pnpm test:e2e) لا Vitest
export default defineConfig({
  test: { exclude: ['e2e/**', 'node_modules/**', '.next/**'] },
});
