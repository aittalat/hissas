import { expect, open, test } from './fixtures';

test('إنشاء مدرسة فارغة: بياناتها معزولة وتبدأ بصفحة البداية', async ({ page }) => {
  await page.goto('/owner');
  await page.getByRole('button', { name: '+ إضافة مدرسة' }).click();
  await page.fill('#ns-name', 'Ecole Atlas');
  await expect(page.locator('#ns-slug')).toHaveValue('ecole-atlas');
  await page.getByRole('button', { name: 'إنشاء المدرسة' }).click();
  await expect(page).toHaveURL(/\/s\/ecole-atlas\/timetable$/);
  await expect(page.getByRole('heading', { name: 'ابدأ بإدخال بيانات Ecole Atlas' })).toBeVisible();
  await open(page, '/s/ecole-atlas/students');
  await expect(page.locator('.pcard')).toHaveCount(0);
  await expect(page.getByText('لا يوجد تلاميذ بعد')).toBeVisible();
  // المدرسة التجريبية لم تتغير
  await open(page, '/s/demo/students');
  await expect(page.locator('.pcard')).toHaveCount(48);
  await page.goto('/owner');
  await expect(page.locator('.school')).toHaveCount(2);
});

test('هوية المدرسة: الاسم يظهر في الرأس، وتغيير الرابط ينقل الصفحة', async ({ page }) => {
  await open(page, '/s/demo/brand');
  await page.fill('#br-name', 'مدرسة الأطلس');
  await page.locator('#br-name').blur();
  await expect(page.locator('header.top h1')).toHaveText('مدرسة الأطلس');
  await page.fill('#br-slug', 'Atlas School');
  await page.locator('#br-slug').blur();
  await expect(page).toHaveURL(/\/s\/atlas-school\/brand$/);
  await expect(page.locator('.appprev')).toContainText('https://atlas-school.hissas.ma');
});
