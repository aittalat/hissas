import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // المتصفح يُفتح مرة لكل ملف
    testTimeout: 300_000,
    hookTimeout: 60_000,
  },
});
