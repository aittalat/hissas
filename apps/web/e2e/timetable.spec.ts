import { expect, open, stat, test, toast } from './fixtures';

test.describe('جدول الحصص', () => {
  test('المدرسة التجريبية: جدول كامل بجودة 92 وبدون تعارض', async ({ page }) => {
    await open(page, '/');
    await expect(page).toHaveURL(/\/s\/demo$/);
    await open(page, '/s/demo/timetable');
    await expect(stat(page, 'جودة الجدول')).toContainText('92');
    await expect(stat(page, 'الحصص المبرمجة')).toContainText('205');
    await expect(stat(page, 'تعارضات')).toHaveText('0');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('التوليد التلقائي يرجع جدولا كاملا بدون تعارض', async ({ page }) => {
    await open(page, '/s/demo/timetable');
    await page.getByRole('button', { name: 'توليد الجدول تلقائيا' }).click();
    await expect(toast(page)).toHaveText('تم توليد جدول كامل بدون تعارض', { timeout: 45_000 });
    await expect(stat(page, 'تعارضات')).toHaveText('0');
    await expect(stat(page, 'الحصص المبرمجة')).toContainText('205');
  });

  test('تغيير الساعات يُظهر تنبيه "أعد التوليد"، والتوقيت يُحفظ مع التوليد', async ({ page }) => {
    await open(page, '/s/demo/timetable/data');
    await page.locator('table.plain tbody tr').nth(2).click();
    const row = page.locator('.hrow').first();
    const before = await row.locator('b.num').textContent();
    await row.getByLabel('زيادة').click();
    await expect(row.locator('b.num')).not.toHaveText(before ?? '');
    await open(page, '/s/demo/timetable');
    await expect(page.locator('.banner').first()).toContainText('أعد توليد الجدول');
  });

  test('معالج إضافة أستاذ', async ({ page }) => {
    await open(page, '/s/demo/timetable/data?new=1');
    await page.fill('#nt-n', 'أ. أستاذ الاختبار');
    await page.locator('.hrow input[type=checkbox]').first().check();
    await page.getByRole('button', { name: 'حفظ الأستاذ' }).click();
    await expect(page.getByRole('heading', { name: 'تمت إضافة أ. أستاذ الاختبار' })).toBeVisible();
    await expect(page.locator('table.plain tbody')).toContainText('أ. أستاذ الاختبار');
  });

  test('غياب أستاذ: التعويض يظهر في تطبيق الولي', async ({ page }) => {
    await open(page, '/s/demo/timetable/absences');
    await page.selectOption('#abs-d', '0');
    await page.getByRole('button', { name: 'عرض الحصص المتأثرة' }).click();
    const first = page.locator('.affected').first();
    await expect(first.locator('label.opt').first()).toContainText('الأفضل');
    await page.getByRole('button', { name: 'اعتماد وإشعار الجميع' }).click();
    await expect(toast(page)).toContainText('اعتُمد التعويض');
    await expect(page.locator('table.plain tbody tr')).not.toHaveCount(0);
    await open(page, '/s/demo/comm');
    await page.locator('.phone .chips .chip', { hasText: 'الإثنين' }).click();
    await expect(page.locator('.phone .card').first()).toBeVisible();
  });
});
