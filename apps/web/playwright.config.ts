import { defineConfig } from '@playwright/test';

/**
 * اختبارات الواجهة من طرف إلى طرف على نسخة الإنتاج (`next build` أولا).
 * CHROMIUM_PATH: متصفح مثبت مسبقا (البيئة السحابية)؛ وإلا متصفح Playwright.
 */
const PORT = 3210;
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ar-MA',
    viewport: { width: 1300, height: 900 },
    launchOptions: { executablePath },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: `http://localhost:${PORT}/owner`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
