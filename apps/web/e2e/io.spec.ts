import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, open, test, toast } from './fixtures';

test('القالب: تصدير Excel ثم استيراده يعيد نفس المدرسة ويولّد الجدول', async ({ page }) => {
  await open(page, '/s/demo/timetable/io');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تحميل القالب' }).click(),
  ]);
  // مسار ASCII: setInputFiles لا يقرأ ملفا في مسار بحروف عربية (اسم مجلد الاختبار)
  const path = join(mkdtempSync(join(tmpdir(), 'hissas-')), 'donnees-ecole.xlsx');
  await dl.saveAs(path);
  expect(readFileSync(path).subarray(0, 2).toString()).toBe('PK');
  await page.setInputFiles('#io-file', path);
  await expect(page.locator('.affected .tag.acc')).toHaveText('8 أقسام · 17 أستاذا');
  await expect(page.locator('ul.chg')).toHaveCount(0);
  await page.getByRole('button', { name: /تأكيد الاستيراد/ }).click();
  await expect(toast(page)).toHaveText('استُورد 8 أقسام، وتولّد الجدول: 205/205 حصة', {
    timeout: 45_000,
  });
  await expect(page).toHaveURL(/\/timetable$/);
});

test('اللصق من Excel: معاينة ثم رسالة واضحة عند غياب الأعمدة', async ({ page }) => {
  await open(page, '/s/demo/timetable/io');
  await page.locator('summary').click();
  await page.fill('#io-p1', 'القسم\tالمادة\tالأستاذ\tالساعات\n1AC-A\tالرياضيات\tأ. تجربة\t4');
  await page.getByRole('button', { name: 'قراءة البيانات الملصقة' }).click();
  await expect(page.locator('.affected .tag.acc')).toHaveText('1 أقسام · 1 أستاذا');
  await page.fill('#io-p1', 'x\ty\n1\t2');
  await page.getByRole('button', { name: 'قراءة البيانات الملصقة' }).click();
  await expect(page.locator('.banner.bad')).toBeVisible();
});

test('صفحة الطباعة', async ({ page }, info) => {
  await open(page, '/s/demo/timetable/io');
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'تحميل' }).nth(1).click(),
  ]);
  const path = info.outputPath('p.html');
  await dl.saveAs(path);
  const html = readFileSync(path, 'utf8');
  expect(html).toContain('@page{size:A4 landscape');
  expect(html.match(/class="sheet"/g)?.length).toBe(8 + 17);
  await expect(toast(page)).toHaveText('تم حفظ الملف');
});
