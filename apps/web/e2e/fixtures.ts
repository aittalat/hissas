import { test as base, expect, type Page } from '@playwright/test';

/**
 * كل اختبار يبدأ بمتصفح فارغ (localStorage فارغ ← المدرسة التجريبية)، ويفشل عند أي خطأ
 * في وحدة التحكم أو في الصفحة.
 */
export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await use(errors);
      expect(errors, 'أخطاء في المتصفح').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** فتح صفحة مدرسة وانتظار تحميل المخزن. */
export async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator('main .panel, main .mhead').first().waitFor();
}

/** نص الإشعار القصير (toast). */
export const toast = (page: Page) => page.locator('#toast');

/** قيمة بطاقة إحصاء بعنوانها. */
export const stat = (page: Page, label: string) =>
  page.locator('.stat').filter({ hasText: label }).locator('b').first();
