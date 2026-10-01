import { expect, open, stat, test, tinyPng, toast } from './fixtures';

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
    await page.getByRole('button', { name: 'إضافة تلميذ', exact: true }).click();
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
    await page.getByRole('button', { name: 'تسجيل حادثة' }).click();
    const dialog = page.getByRole('dialog', { name: 'تسجيل حادثة أو سلوك' });
    await dialog.locator('#in-title').fill('شجار في الساحة');
    await dialog.locator('#in-grav').selectOption('serious');
    await dialog.getByRole('button', { name: 'حفظ', exact: true }).click();
    await expect(toast(page)).toContainText('/20 نقطة · أُشعر الولي');
    await expect(dialog).toHaveCount(0);
    await page.locator('.row', { hasText: 'شجار في الساحة' }).click();
    await expect(page.locator('.modal .smiley')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal')).toHaveCount(0);
  });

  test('كل الشاشات تُفتح بدون أخطاء', async ({ page }) => {
    for (const p of [
      '',
      '/students',
      '/students?tab=archived',
      '/students?tab=lists',
      '/students?tab=photos',
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

  test('صورة التلميذ: البطاقة ← لوحة التفاصيل ← رفع الصورة', async ({ page }) => {
    await open(page, '/s/demo/students');
    const card = page.locator('.wcard').first();
    const name = (await card.locator('b').textContent()) ?? '';
    await card.click();
    const panel = page.getByRole('complementary', { name: `تفاصيل ${name}` });
    await expect(panel.locator('.info')).toContainText('رقم التسجيل');
    await panel.getByLabel('صورة التلميذ').setInputFiles(tinyPng);
    await expect(toast(page)).toHaveText('حُفظت صورة التلميذ');
    await expect(panel.locator('.ph img').first()).toHaveAttribute('src', /^data:image\/jpeg/);
    await expect(card.locator('.ph img')).toHaveAttribute('src', /^data:image\/jpeg/);
    await panel.getByRole('button', { name: 'حذف الصورة' }).click();
    await expect(toast(page)).toHaveText('حُذفت الصورة');
  });

  test('تصفية التلاميذ والعرض كلائحة', async ({ page }) => {
    await open(page, '/s/demo/students');
    await page.getByRole('button', { name: /تصفية حسب/ }).click();
    await page.selectOption('#f-cls', { label: 'TC' });
    await page.getByRole('button', { name: 'إناث' }).click();
    await page.getByRole('button', { name: 'لائحة', exact: true }).click();
    const rows = page.locator('table.plain tbody tr');
    await expect(rows.first()).toBeVisible();
    for (const t of await rows.allTextContents()) expect(t).toContain('TC');
  });
});
