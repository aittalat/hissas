import { expect, open, stat, test, toast } from './fixtures';

test.describe('الحياة المدرسية', () => {
  test('تسجيل الغياب يحدّث لوحة اليوم ويرسل رسالة للولي', async ({ page }) => {
    await open(page, '/s/demo');
    const absent = Number(await stat(page, 'الغائبون اليوم').textContent());
    await page.getByRole('link', { name: 'تسجيل الغياب' }).click();
    await expect(page.locator('.subtabs [aria-pressed=true]')).toHaveText('تسجيل الغياب');
    await page.locator('.list .row').first().getByRole('button', { name: 'غائب' }).click();
    await page.locator('.list .row').nth(1).getByRole('button', { name: 'متأخر' }).click();
    await page.getByRole('button', { name: 'حفظ وإشعار الأولياء (2)' }).click();
    await expect(toast(page)).toHaveText('سُجّل 2 وأُشعر الأولياء');
    await open(page, '/s/demo');
    await expect(stat(page, 'الغائبون اليوم')).toHaveText(String(absent + 1));
    await expect(stat(page, 'المتأخرون اليوم')).toHaveText('1');
  });

  test('اختيار سبب يجعل الغياب مبررا', async ({ page }) => {
    await open(page, '/s/demo/absences');
    const row = page.locator('table.abs tbody tr').first();
    await row.locator('input[type=checkbox]').uncheck();
    await row.locator('select').selectOption('مرض');
    await expect(row.locator('input[type=checkbox]')).toBeChecked();
  });

  test('تلميذ جديد يُربط بإخوته عبر اسم الولي', async ({ page }) => {
    await open(page, '/s/demo/parents');
    const parent = (await page.locator('.pcard b').first().textContent()) ?? '';
    await open(page, '/s/demo/students');
    await page.getByRole('button', { name: '+ إضافة تلميذ' }).click();
    await page.fill('#sn-fn', 'سلمى');
    await page.fill('#sn-ln', 'اختبار');
    await page.fill('#sn-pn', parent);
    await page.getByRole('button', { name: 'حفظ التلميذ' }).click();
    await expect(toast(page)).toHaveText('أُضيف التلميذ ورُبط بإخوته');
    await expect(page.locator('.modal h2')).toHaveText('سلمى اختبار');
    await expect(page.locator('.modal .kvl').last()).toContainText(parent);
  });

  test('حادثة سلبية تنقص نقاط السلوك وتُسجل في الملف', async ({ page }) => {
    await open(page, '/s/demo/discipline');
    await page.fill('#in-title', 'شجار في الساحة');
    await page.selectOption('#in-grav', 'serious');
    await page.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(toast(page)).toContainText('/20 نقطة · أُشعر الولي');
    await page.locator('.row', { hasText: 'شجار في الساحة' }).click();
    await expect(page.locator('.modal .points')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal')).toHaveCount(0);
  });

  test('كل الشاشات تُفتح بدون أخطاء', async ({ page }) => {
    for (const p of [
      '',
      '/students',
      '/students?tab=archived',
      '/students?tab=lists',
      '/parents',
      '/teachers',
      '/teachers?tab=reports',
      '/classes',
      '/absences',
      '/absences?tab=track',
      '/discipline',
      '/comm',
      '/modules',
      '/brand',
      '/timetable/config',
      '/timetable/network',
    ])
      await open(page, `/s/demo${p}`);
  });
});
